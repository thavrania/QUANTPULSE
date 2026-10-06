import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { BrokerVaultEntry, BrokerVaultStatus } from '@/lib/types/quant';

/**
 * Formats a remaining time duration into human-readable countdown string
 */
export function formatTokenCountdown(expiryDateString?: string | null): {
  formatted: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  remainingMs: number;
} {
  if (!expiryDateString) {
    return { formatted: 'Unknown', isExpired: false, isExpiringSoon: false, remainingMs: 0 };
  }

  const expiryTime = new Date(expiryDateString).getTime();
  const now = Date.now();
  const remainingMs = expiryTime - now;

  if (remainingMs <= 0) {
    return { formatted: 'Expired', isExpired: true, isExpiringSoon: false, remainingMs: 0 };
  }

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

  const isExpiringSoon = remainingMs <= 2 * 60 * 60 * 1000; // < 2 hours

  let formatted = '';
  if (hours > 0) {
    formatted = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    formatted = `${minutes}m ${seconds}s`;
  } else {
    formatted = `${seconds}s`;
  }

  return { formatted, isExpired: false, isExpiringSoon, remainingMs };
}

/**
 * Masks an API token for safe UI display
 */
export function maskToken(token?: string | null): string {
  if (!token) return 'Not Configured';
  if (token.length <= 12) return '••••••••••••';
  return `${token.slice(0, 6)}••••${token.slice(-4)}`;
}

/**
 * Saves broker credentials to both the Supabase Cloud Vault and browser localStorage
 */
export async function saveBrokerCredentialsToVault(params: {
  brokerName?: string;
  clientId: string;
  accessToken: string;
  expiryHours?: number;
  latencyMs?: number;
  availableMargin?: number;
}): Promise<{ success: boolean; message: string; expiryAt: string }> {
  const brokerName = params.brokerName || 'DHAN';
  const clientId = params.clientId.trim();
  const accessToken = params.accessToken.trim();
  const expiryHours = params.expiryHours ?? 24;

  const expiryDate = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
  const expiryIso = expiryDate.toISOString();

  // 1. Always update browser localStorage if on client
  if (typeof window !== 'undefined') {
    localStorage.setItem('qp_broker_type', brokerName);
    localStorage.setItem('qp_dhan_client_id', clientId);
    localStorage.setItem('qp_dhan_access_token', accessToken);
    localStorage.setItem('qp_token_expiry_at', expiryIso);
    if (params.latencyMs !== undefined) {
      localStorage.setItem('qp_broker_latency_ms', String(params.latencyMs));
    }
    if (params.availableMargin !== undefined) {
      localStorage.setItem('qp_broker_available_margin', String(params.availableMargin));
    }
  }

  // 2. Persist to Supabase broker_vault if configured
  if (isSupabaseConfigured && supabase) {
    try {
      // Mark existing entries as non-primary
      await supabase
        .from('broker_vault')
        .update({ is_primary: false })
        .eq('broker_name', brokerName);

      // Insert new primary credential record
      const { error } = await supabase.from('broker_vault').insert({
        broker_name: brokerName,
        client_id: clientId,
        access_token: accessToken,
        token_generated_at: new Date().toISOString(),
        token_expiry_at: expiryIso,
        status: 'ACTIVE',
        last_ping_latency_ms: params.latencyMs || 0,
        available_margin: params.availableMargin || 0,
        is_primary: true,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.warn('Supabase broker_vault insert notice:', error.message);
        return {
          success: true,
          message: 'Saved to Local Storage (Supabase table pending or cached).',
          expiryAt: expiryIso,
        };
      }

      return {
        success: true,
        message: 'Saved & Synced to Supabase Cloud Vault (24h Auto-Auth active)!',
        expiryAt: expiryIso,
      };
    } catch (err: any) {
      console.warn('Failed to save to Supabase broker_vault:', err);
      return {
        success: true,
        message: 'Saved to Local Storage.',
        expiryAt: expiryIso,
      };
    }
  }

  return {
    success: true,
    message: 'Saved to Local Storage.',
    expiryAt: expiryIso,
  };
}

/**
 * Resolves active broker credentials across all tiers:
 * 1. Supabase Cloud Vault (highest priority for multi-device & headless jobs)
 * 2. Browser localStorage (client fallback)
 * 3. Environment Variables (DHAN_CLIENT_ID, DHAN_ACCESS_TOKEN)
 */
export async function getActiveBrokerCredentials(): Promise<{
  clientId: string;
  accessToken: string;
  brokerName: string;
  expiryAt: string | null;
  status: BrokerVaultStatus;
}> {
  // 1. Check Supabase Cloud Vault
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('broker_vault')
        .select('*')
        .eq('is_primary', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data && data.client_id && data.access_token) {
        const countdown = formatTokenCountdown(data.token_expiry_at);
        return {
          clientId: data.client_id,
          accessToken: data.access_token,
          brokerName: data.broker_name || 'DHAN',
          expiryAt: data.token_expiry_at,
          status: {
            isConfigured: true,
            brokerName: data.broker_name || 'DHAN',
            clientId: data.client_id,
            maskedToken: maskToken(data.access_token),
            tokenExpiryAt: data.token_expiry_at,
            tokenTimeRemaining: countdown.formatted,
            isExpired: countdown.isExpired,
            isExpiringSoon: countdown.isExpiringSoon,
            lastLatencyMs: data.last_ping_latency_ms,
            availableMargin: Number(data.available_margin || 0),
            source: 'VAULT',
          },
        };
      }
    } catch (err) {
      console.warn('Error reading from broker_vault:', err);
    }
  }

  // 2. Client-side LocalStorage fallback
  if (typeof window !== 'undefined') {
    const localCid = localStorage.getItem('qp_dhan_client_id') || '';
    const localToken = localStorage.getItem('qp_dhan_access_token') || '';
    const localExpiry = localStorage.getItem('qp_token_expiry_at');
    const localLatency = Number(localStorage.getItem('qp_broker_latency_ms') || 0);
    const localMargin = Number(localStorage.getItem('qp_broker_available_margin') || 0);

    if (localCid && localToken) {
      const countdown = formatTokenCountdown(localExpiry);
      return {
        clientId: localCid,
        accessToken: localToken,
        brokerName: localStorage.getItem('qp_broker_type') || 'DHAN',
        expiryAt: localExpiry,
        status: {
          isConfigured: true,
          brokerName: localStorage.getItem('qp_broker_type') || 'DHAN',
          clientId: localCid,
          maskedToken: maskToken(localToken),
          tokenExpiryAt: localExpiry,
          tokenTimeRemaining: countdown.formatted,
          isExpired: countdown.isExpired,
          isExpiringSoon: countdown.isExpiringSoon,
          lastLatencyMs: localLatency || null,
          availableMargin: localMargin || null,
          source: 'LOCAL',
        },
      };
    }
  }

  // 3. Automated Server-Side Authentication / Environment Variables
  if (typeof window === 'undefined') {
    try {
      const { dhanAuthService } = await import('./dhanAuthService');
      const creds = dhanAuthService.getConfiguredCredentials();
      if (creds.hasAutomatedCreds) {
        const auth = await dhanAuthService.getValidAccessToken();
        if (auth && auth.accessToken) {
          const status = await dhanAuthService.getAuthStatus();
          return {
            clientId: auth.clientId,
            accessToken: auth.accessToken,
            brokerName: 'DHAN',
            expiryAt: status.tokenExpiryAt,
            status: {
              isConfigured: true,
              brokerName: 'DHAN',
              clientId: auth.clientId,
              maskedToken: maskToken(auth.accessToken),
              tokenExpiryAt: status.tokenExpiryAt,
              tokenTimeRemaining: status.timeRemainingFormatted,
              isExpired: !status.tokenValid,
              isExpiringSoon: status.isExpiringSoon,
              source: 'ENV',
            },
          };
        }
      }
    } catch {}
  }

  const envCid = process.env.DHAN_CLIENT_ID || '';
  const envToken = process.env.DHAN_ACCESS_TOKEN || '';

  if (envCid && envToken) {
    return {
      clientId: envCid,
      accessToken: envToken,
      brokerName: 'DHAN',
      expiryAt: null,
      status: {
        isConfigured: true,
        brokerName: 'DHAN',
        clientId: envCid,
        maskedToken: maskToken(envToken),
        tokenExpiryAt: null,
        tokenTimeRemaining: 'Permanent/Env',
        isExpired: false,
        isExpiringSoon: false,
        source: 'ENV',
      },
    };
  }

  // 4. Not configured
  return {
    clientId: '',
    accessToken: '',
    brokerName: 'DHAN',
    expiryAt: null,
    status: {
      isConfigured: false,
      brokerName: 'DHAN',
      clientId: '',
      maskedToken: 'Not Configured',
      tokenExpiryAt: null,
      tokenTimeRemaining: 'N/A',
      isExpired: false,
      isExpiringSoon: false,
      source: 'NONE',
    },
  };
}
