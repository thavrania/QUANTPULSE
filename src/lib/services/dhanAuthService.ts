// =====================================================================
// QUANTPULSE — Dhan HQ Automated Authentication & Token Management Service
// Model: API Key + API Secret + TOTP -> Automated Access Token -> Dhan API
// Server-Side Only: Never exposes credentials or tokens to browser/client.
// =====================================================================

import crypto from 'crypto';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { DHAN_BASE_URL } from '../broker/dhan/dhanConstants';
import { DhanAuthStatus } from '../types/quant';

export const DHAN_AUTH_BASE_URL = 'https://auth.dhan.co';

/**
 * Decodes a Base32 encoded string into a Buffer.
 * Adheres to RFC 4648 / RFC 6238 Base32 specifications.
 */
export function base32Decode(base32: string): Buffer {
  if (!base32) return Buffer.alloc(0);
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Generates an RFC 6238 Time-based One-Time Password (TOTP)
 * Using HMAC-SHA1, 30-second time step, and 6 numeric digits.
 */
export function generateDhanTOTP(
  secret: string,
  timestampSeconds: number = Math.floor(Date.now() / 1000),
  timeStep: number = 30,
  digits: number = 6
): string {
  if (!secret) return '';
  const key = base32Decode(secret);
  if (key.length === 0) return '';

  const counter = Math.floor(timestampSeconds / timeStep);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = (binary % Math.pow(10, digits)).toString().padStart(digits, '0');
  return otp;
}

/**
 * Masks credentials or tokens for safe logging and observability.
 */
export function maskCredential(val?: string | null): string {
  if (!val) return 'Not Configured';
  if (val.length <= 8) return '••••••••';
  return `${val.slice(0, 4)}••••${val.slice(-4)}`;
}

interface CachedTokenState {
  token: string;
  clientId: string;
  expiryMs: number;
  expiryIso: string;
  generatedAtIso: string;
  source: 'AUTOMATED_TOTP' | 'RENEWED' | 'VAULT' | 'ENV_STATIC' | 'CONSENT_CALLBACK' | 'MANUAL' | 'NONE';
}

export class DhanAuthService {
  private cache: CachedTokenState | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private lastError: string | null = null;
  private lastRefreshedAt: string | null = null;

  /**
   * Resolves configured credentials from server environment
   */
  public getConfiguredCredentials(): {
    clientId: string;
    apiKey: string;
    apiSecret: string;
    totpSecret: string;
    staticToken: string;
    hasAutomatedCreds: boolean;
  } {
    const clientId = (process.env.DHAN_CLIENT_ID || '').trim();
    const apiKey = (process.env.DHAN_API_KEY || '').trim();
    const apiSecret = (process.env.DHAN_API_SECRET || '').trim();
    const totpSecret = (process.env.DHAN_TOTP_SECRET || '').trim();
    const staticToken = (process.env.DHAN_ACCESS_TOKEN || '').trim();

    const hasAutomatedCreds = Boolean(clientId && apiKey && apiSecret && totpSecret);

    return {
      clientId,
      apiKey,
      apiSecret,
      totpSecret,
      staticToken,
      hasAutomatedCreds,
    };
  }

  /**
   * Retrieves a guaranteed-valid Dhan access token.
   * If cached token is active (> 5 minutes until expiry), reuses it.
   * If expired or near expiry, triggers token generation or renewal.
   * Single-flight mutex lock ensures concurrent callers wait for the same refresh.
   */
  public async getValidAccessToken(options: { forceRefresh?: boolean } = {}): Promise<{
    accessToken: string;
    clientId: string;
    source: string;
  }> {
    const now = Date.now();
    const safetyBufferMs = 5 * 60 * 1000; // 5-minute pre-expiry buffer

    // 1. Check in-memory valid token
    if (
      !options.forceRefresh &&
      this.cache &&
      this.cache.token &&
      now + safetyBufferMs < this.cache.expiryMs
    ) {
      return {
        accessToken: this.cache.token,
        clientId: this.cache.clientId,
        source: this.cache.source,
      };
    }

    // 2. Single-flight lock: coalesce concurrent refresh calls
    if (this.refreshPromise) {
      const refreshedToken = await this.refreshPromise;
      if (refreshedToken && this.cache) {
        return {
          accessToken: this.cache.token,
          clientId: this.cache.clientId,
          source: this.cache.source,
        };
      }
    }

    // 3. Initiate single-flight refresh
    this.refreshPromise = (async () => {
      try {
        return await this.performTokenAcquisition(options.forceRefresh);
      } finally {
        this.refreshPromise = null;
      }
    })();

    const token = await this.refreshPromise;
    if (!token || !this.cache) {
      throw new Error(
        this.lastError ||
          'Failed to acquire valid Dhan access token. Please verify DHAN_CLIENT_ID, DHAN_API_KEY, DHAN_API_SECRET, and DHAN_TOTP_SECRET.'
      );
    }

    return {
      accessToken: this.cache.token,
      clientId: this.cache.clientId,
      source: this.cache.source,
    };
  }

  /**
   * Core token acquisition hierarchy:
   * 1. Renew existing active token via /v2/RenewToken if still valid/renewable
   * 2. Programmatic TOTP token generation if API Key + Secret + TOTP Secret configured
   * 3. Supabase Cloud Vault primary entry
   * 4. Static environment variable DHAN_ACCESS_TOKEN
   */
  private async performTokenAcquisition(forceRefresh?: boolean): Promise<string | null> {
    const creds = this.getConfiguredCredentials();
    const now = Date.now();

    // Strategy A: If we already hold an existing active or recent token, attempt /v2/RenewToken first!
    const candidateToken = this.cache?.token || creds.staticToken || (await this.getVaultToken());
    const targetClientId = creds.clientId || this.cache?.clientId || (await this.getVaultClientId());

    if (candidateToken && targetClientId) {
      const renewResult = await this.attemptTokenRenewal(candidateToken, targetClientId);
      if (renewResult.success && renewResult.accessToken) {
        const expiryIso =
          renewResult.expiryTime || new Date(now + 24 * 60 * 60 * 1000).toISOString();
        this.setCachedToken(
          renewResult.accessToken,
          targetClientId,
          expiryIso,
          'RENEWED'
        );
        await this.persistToVault(renewResult.accessToken, targetClientId, expiryIso);
        this.lastError = null;
        this.lastRefreshedAt = new Date().toISOString();
        return renewResult.accessToken;
      }
    }

    // Strategy B: Automated Token Generation using API Key + API Secret + TOTP
    if (creds.hasAutomatedCreds) {
      const totpResult = await this.attemptTotpAuthentication(creds);
      if (totpResult.success && totpResult.accessToken) {
        const expiryIso =
          totpResult.expiryTime || new Date(now + 24 * 60 * 60 * 1000).toISOString();
        this.setCachedToken(
          totpResult.accessToken,
          creds.clientId,
          expiryIso,
          'AUTOMATED_TOTP'
        );
        await this.persistToVault(totpResult.accessToken, creds.clientId, expiryIso);
        this.lastError = null;
        this.lastRefreshedAt = new Date().toISOString();
        return totpResult.accessToken;
      } else if (totpResult.error) {
        this.lastError = totpResult.error;
      }
    }

    // Strategy C: Check Supabase Cloud Vault
    const vaultRecord = await this.getVaultRecord();
    if (vaultRecord && vaultRecord.access_token) {
      const vaultExpiryMs = new Date(vaultRecord.token_expiry_at || 0).getTime();
      const isExpired = vaultExpiryMs > 0 && now >= vaultExpiryMs;

      if (!isExpired) {
        this.setCachedToken(
          vaultRecord.access_token,
          vaultRecord.client_id || creds.clientId,
          vaultRecord.token_expiry_at,
          'VAULT'
        );
        this.lastError = null;
        return vaultRecord.access_token;
      }
    }

    // Strategy D: Fallback to DHAN_ACCESS_TOKEN from environment if set
    if (creds.staticToken && creds.clientId) {
      const default24h = new Date(now + 24 * 60 * 60 * 1000).toISOString();
      this.setCachedToken(
        creds.staticToken,
        creds.clientId,
        default24h,
        'ENV_STATIC'
      );
      this.lastError = null;
      return creds.staticToken;
    }

    this.lastError = 'No valid Dhan credentials found or authentication failed.';
    return null;
  }

  /**
   * Extends the validity of an active Dhan token by 24 hours using official /v2/RenewToken
   */
  public async attemptTokenRenewal(
    activeToken: string,
    clientId: string
  ): Promise<{ success: boolean; accessToken?: string; expiryTime?: string; error?: string }> {
    try {
      const response = await fetch(`${DHAN_BASE_URL}/RenewToken`, {
        method: 'GET',
        headers: {
          'access-token': activeToken,
          dhanClientId: clientId,
          'client-id': clientId,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Dhan RenewToken rejected (${response.status}): ${errorText}`,
        };
      }

      const data = await response.json();
      const newToken = data.accessToken || data.token;
      const expiry = data.expiryTime;

      if (newToken) {
        return {
          success: true,
          accessToken: newToken,
          expiryTime: expiry,
        };
      }

      return {
        success: false,
        error: 'RenewToken returned 200 OK but missing accessToken field.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: `RenewToken network failure: ${err.message}`,
      };
    }
  }

  /**
   * Generates a new access token programmatically using API Key, API Secret, and TOTP
   */
  public async attemptTotpAuthentication(creds: {
    clientId: string;
    apiKey: string;
    apiSecret: string;
    totpSecret: string;
  }): Promise<{ success: boolean; accessToken?: string; expiryTime?: string; error?: string }> {
    const totpCode = generateDhanTOTP(creds.totpSecret);
    if (!totpCode || totpCode.length !== 6) {
      return { success: false, error: 'Failed to generate valid 6-digit TOTP from DHAN_TOTP_SECRET.' };
    }

    // 1. Primary: Direct automated token generation endpoint
    const directEndpoints = [
      `${DHAN_AUTH_BASE_URL}/app/generateAccessToken`,
      `${DHAN_BASE_URL}/generateAccessToken`,
    ];

    for (const endpoint of directEndpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            app_id: creds.apiKey,
            app_secret: creds.apiSecret,
          },
          body: JSON.stringify({
            dhanClientId: creds.clientId,
            clientId: creds.clientId,
            app_id: creds.apiKey,
            app_secret: creds.apiSecret,
            totp: totpCode,
          }),
          cache: 'no-store',
        });

        if (res.ok) {
          const data = await res.json();
          const token = data.accessToken || data.data?.accessToken || data.token;
          const expiryTime = data.expiryTime || data.data?.expiryTime;
          if (token) {
            return { success: true, accessToken: token, expiryTime };
          }
        }
      } catch (err: any) {
        // Continue to secondary attempt
      }
    }

    // 2. Secondary: If direct token endpoint requires consent handshake:
    try {
      const consentRes = await fetch(
        `${DHAN_AUTH_BASE_URL}/app/generate-consent?client_id=${creds.clientId}`,
        {
          method: 'POST',
          headers: {
            app_id: creds.apiKey,
            app_secret: creds.apiSecret,
            Accept: 'application/json',
          },
          cache: 'no-store',
        }
      );

      if (consentRes.ok) {
        const consentData = await consentRes.json();
        const consentAppId = consentData.consentAppId;
        if (consentAppId) {
          // If interactive browser consent is required, inform caller
          return {
            success: false,
            error: `Consent session initialized (ID: ${consentAppId}). Complete browser verification at /api/broker/dhan/initiate-auth to activate.`,
          };
        }
      }
    } catch {}

    return {
      success: false,
      error: 'Unable to auto-authenticate with Dhan. Verify DHAN_API_KEY, DHAN_API_SECRET, and DHAN_TOTP_SECRET.',
    };
  }

  /**
   * Generates an OAuth consent login URL for user when interactive consent is requested.
   */
  public async generateConsentLoginUrl(): Promise<{
    success: boolean;
    consentUrl?: string;
    consentAppId?: string;
    message?: string;
  }> {
    const creds = this.getConfiguredCredentials();
    if (!creds.apiKey || !creds.apiSecret || !creds.clientId) {
      return {
        success: false,
        message: 'DHAN_CLIENT_ID, DHAN_API_KEY, and DHAN_API_SECRET are required on the server.',
      };
    }

    try {
      const res = await fetch(
        `${DHAN_AUTH_BASE_URL}/app/generate-consent?client_id=${creds.clientId}`,
        {
          method: 'POST',
          headers: {
            app_id: creds.apiKey,
            app_secret: creds.apiSecret,
            Accept: 'application/json',
          },
          cache: 'no-store',
        }
      );

      if (!res.ok) {
        const text = await res.text();
        return {
          success: false,
          message: `Dhan generate-consent failed (${res.status}): ${text}`,
        };
      }

      const data = await res.json();
      const consentAppId = data.consentAppId;

      if (!consentAppId) {
        return { success: false, message: 'Dhan did not return a valid consentAppId.' };
      }

      const consentUrl = `${DHAN_AUTH_BASE_URL}/login/consentApp-login?consentAppId=${consentAppId}`;
      return {
        success: true,
        consentAppId,
        consentUrl,
        message: 'Consent session created successfully.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Network error connecting to Dhan auth: ${err.message}`,
      };
    }
  }

  /**
   * Consumes a tokenId from Dhan OAuth redirect callback and exchanges for an accessToken
   */
  public async consumeConsentToken(tokenId: string): Promise<{
    success: boolean;
    accessToken?: string;
    message?: string;
  }> {
    const creds = this.getConfiguredCredentials();
    if (!creds.apiKey || !creds.apiSecret) {
      return { success: false, message: 'DHAN_API_KEY and DHAN_API_SECRET are not configured on server.' };
    }

    try {
      const res = await fetch(
        `${DHAN_AUTH_BASE_URL}/app/consumeApp-consent?tokenId=${encodeURIComponent(tokenId)}`,
        {
          method: 'POST',
          headers: {
            app_id: creds.apiKey,
            app_secret: creds.apiSecret,
            Accept: 'application/json',
          },
          cache: 'no-store',
        }
      );

      if (!res.ok) {
        const text = await res.text();
        return { success: false, message: `Dhan consumeApp-consent failed (${res.status}): ${text}` };
      }

      const data = await res.json();
      const token = data.accessToken || data.token;
      const expiry = data.expiryTime || new Date(Date.now() + 24 * 3600 * 1000).toISOString();

      if (token) {
        this.setCachedToken(token, creds.clientId, expiry, 'CONSENT_CALLBACK');
        await this.persistToVault(token, creds.clientId, expiry);
        this.lastRefreshedAt = new Date().toISOString();
        return {
          success: true,
          accessToken: token,
          message: 'Access token acquired and saved successfully via OAuth consent.',
        };
      }

      return { success: false, message: 'No access token in Dhan response payload.' };
    } catch (err: any) {
      return { success: false, message: `Error consuming consent token: ${err.message}` };
    }
  }

  /**
   * Stores a token directly (e.g. from callback or manual input)
   */
  public async saveToken(
    token: string,
    clientId: string,
    expiryIso?: string,
    source: 'CONSENT_CALLBACK' | 'MANUAL' | 'RENEWED' | 'AUTOMATED_TOTP' = 'MANUAL'
  ): Promise<void> {
    const expiry = expiryIso || new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    this.setCachedToken(token, clientId, expiry, source);
    await this.persistToVault(token, clientId, expiry);
    this.lastRefreshedAt = new Date().toISOString();
  }

  /**
   * Explicitly invalidates the cached token to force a refresh on the next request.
   */
  public invalidateToken(): void {
    if (this.cache) {
      this.cache.expiryMs = 0;
      this.cache.expiryIso = new Date(0).toISOString();
    }
  }

  /**
   * Returns safe health and observability status without leaking raw tokens or secrets.
   */
  public async getAuthStatus(): Promise<DhanAuthStatus> {
    const creds = this.getConfiguredCredentials();
    const now = Date.now();

    // Check if token exists in memory or vault
    let currentToken = this.cache?.token;
    let currentExpiryIso = this.cache?.expiryIso || null;
    let currentClientId = this.cache?.clientId || creds.clientId;
    let source = this.cache?.source || 'NONE';

    if (!currentToken) {
      const vaultRecord = await this.getVaultRecord();
      if (vaultRecord && vaultRecord.access_token) {
        currentToken = vaultRecord.access_token;
        currentExpiryIso = vaultRecord.token_expiry_at || null;
        currentClientId = vaultRecord.client_id || creds.clientId;
        source = 'VAULT';
      } else if (creds.staticToken) {
        currentToken = creds.staticToken;
        source = 'ENV_STATIC';
      }
    }

    const expiryMs = this.cache ? this.cache.expiryMs : (currentExpiryIso ? new Date(currentExpiryIso).getTime() : 0);
    const isConfigured = Boolean(creds.hasAutomatedCreds || currentToken);

    let tokenValid = false;
    let remainingMinutes = 0;
    let isExpiringSoon = false;
    let timeRemainingFormatted = 'Not Configured';

    if (currentToken && this.cache?.expiryMs !== 0) {
      if (expiryMs > 0) {
        const remainingMs = expiryMs - now;
        if (remainingMs > 0) {
          tokenValid = true;
          remainingMinutes = Math.floor(remainingMs / (1000 * 60));
          isExpiringSoon = remainingMs < 2 * 60 * 60 * 1000; // < 2 hours

          const hours = Math.floor(remainingMinutes / 60);
          const mins = remainingMinutes % 60;
          timeRemainingFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        } else {
          tokenValid = false;
          timeRemainingFormatted = 'Expired';
        }
      } else {
        // Permanent / Static Token without expiration date
        tokenValid = true;
        timeRemainingFormatted = 'Active (Static)';
      }
    } else if (currentToken && this.cache?.expiryMs === 0) {
      tokenValid = false;
      timeRemainingFormatted = 'Expired';
    }

    let authMode: 'AUTOMATED_API_KEY_TOTP' | 'MANUAL_VAULT' | 'ENV_STATIC' | 'NONE' = 'NONE';
    if (creds.hasAutomatedCreds) {
      authMode = 'AUTOMATED_API_KEY_TOTP';
    } else if (source === 'VAULT' || source === 'MANUAL') {
      authMode = 'MANUAL_VAULT';
    } else if (source === 'ENV_STATIC') {
      authMode = 'ENV_STATIC';
    }

    return {
      isConfigured,
      authMode,
      tokenValid,
      isExpiringSoon,
      timeRemainingFormatted,
      remainingMinutes,
      maskedClientId: maskCredential(currentClientId),
      hasApiKey: Boolean(creds.apiKey),
      hasApiSecret: Boolean(creds.apiSecret),
      hasTotpSecret: Boolean(creds.totpSecret),
      lastRefreshedAt: this.lastRefreshedAt,
      tokenExpiryAt: currentExpiryIso,
      source,
      lastError: this.lastError,
    };
  }

  // --- Internal Helpers ---

  private setCachedToken(
    token: string,
    clientId: string,
    expiryIso: string,
    source: CachedTokenState['source']
  ): void {
    const expiryMs = new Date(expiryIso).getTime();
    this.cache = {
      token,
      clientId,
      expiryMs,
      expiryIso,
      generatedAtIso: new Date().toISOString(),
      source,
    };
  }

  private async persistToVault(
    token: string,
    clientId: string,
    expiryIso: string
  ): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      await supabase
        .from('broker_vault')
        .update({ is_primary: false })
        .eq('broker_name', 'DHAN');

      await supabase.from('broker_vault').insert({
        broker_name: 'DHAN',
        client_id: clientId,
        access_token: token,
        token_generated_at: new Date().toISOString(),
        token_expiry_at: expiryIso,
        status: 'ACTIVE',
        is_primary: true,
        updated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn('[DhanAuthService] Supabase Cloud Vault persist notice:', err.message);
    }
  }

  private async getVaultRecord(): Promise<any | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from('broker_vault')
        .select('*')
        .eq('broker_name', 'DHAN')
        .eq('is_primary', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) return data;
    } catch {}
    return null;
  }

  private async getVaultToken(): Promise<string | null> {
    const record = await this.getVaultRecord();
    return record?.access_token || null;
  }

  private async getVaultClientId(): Promise<string | null> {
    const record = await this.getVaultRecord();
    return record?.client_id || null;
  }
}

// Global Singleton Instance
export const dhanAuthService = new DhanAuthService();
