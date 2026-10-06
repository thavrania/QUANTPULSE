// =====================================================================
// QUANTPULSE — Centralized Dhan HQ API Client
// Wraps all Dhan HTTP operations with:
// 1. Automated token resolution via DhanAuthService
// 2. Automatic 401 / DH-901 token expiration retry-once recovery
// 3. Centralized latency measurement and robust error parsing
// =====================================================================

import { DHAN_BASE_URL } from './dhanConstants';
import { dhanAuthService } from '../../services/dhanAuthService';

export interface DhanRequestOptions extends RequestInit {
  requiresAuth?: boolean;
  overrideClientId?: string;
  overrideAccessToken?: string;
  skipRetryOn401?: boolean;
}

export interface DhanApiResponse<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  rawText?: string;
  retried?: boolean;
  latencyMs: number;
}

export class DhanApiClient {
  private authService: typeof dhanAuthService;

  constructor(authService: typeof dhanAuthService = dhanAuthService) {
    this.authService = authService;
  }

  /**
   * Performs an HTTP request to the Dhan HQ API.
   * Path should be relative (e.g. '/marketfeed/quote') or absolute URL.
   */
  public async request<T = any>(
    path: string,
    options: DhanRequestOptions = {}
  ): Promise<DhanApiResponse<T>> {
    const startTime = Date.now();
    const url = path.startsWith('http') ? path : `${DHAN_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const requiresAuth = options.requiresAuth !== false;

    // 1. Resolve credentials
    let token = options.overrideAccessToken;
    let clientId = options.overrideClientId;

    if (requiresAuth && (!token || !clientId)) {
      try {
        const auth = await this.authService.getValidAccessToken();
        token = token || auth.accessToken;
        clientId = clientId || auth.clientId;
      } catch (authErr: any) {
        return {
          ok: false,
          status: 401,
          data: null,
          error: `Authentication failed: ${authErr.message}`,
          latencyMs: Date.now() - startTime,
        };
      }
    }

    // 2. Prepare headers
    const headers = new Headers(options.headers || {});
    if (requiresAuth && token) {
      headers.set('access-token', token);
    }
    if (requiresAuth && clientId) {
      headers.set('client-id', clientId);
      headers.set('dhanClientId', clientId);
    }
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    const fetchOptions: RequestInit = {
      ...options,
      headers,
    };

    // 3. First fetch attempt
    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (networkErr: any) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: `Network error connecting to Dhan: ${networkErr.message}`,
        latencyMs: Date.now() - startTime,
      };
    }

    let rawText = '';
    try {
      rawText = await response.text();
    } catch {}

    let parsedData: any = null;
    try {
      if (rawText) {
        parsedData = JSON.parse(rawText);
      }
    } catch {
      // rawText is not JSON
    }

    // Check if response indicates token expiration / unauthorized
    const isTokenExpired =
      response.status === 401 ||
      (parsedData &&
        (parsedData.errorCode === 'DH-901' ||
          parsedData.status === 'DH-901' ||
          (typeof parsedData.remarks === 'string' &&
            parsedData.remarks.toLowerCase().includes('token expired')) ||
          (typeof parsedData.message === 'string' &&
            parsedData.message.toLowerCase().includes('token expired'))));

    // 4. Automatic 401 Retry-Once Logic
    if (isTokenExpired && !options.skipRetryOn401 && !options.overrideAccessToken) {
      console.warn(`[DhanApiClient] 401/DH-901 encountered on ${path}. Invalidating and refreshing token once...`);
      this.authService.invalidateToken();

      try {
        const refreshed = await this.authService.getValidAccessToken({ forceRefresh: true });
        if (refreshed.accessToken) {
          headers.set('access-token', refreshed.accessToken);
          if (refreshed.clientId) {
            headers.set('client-id', refreshed.clientId);
            headers.set('dhanClientId', refreshed.clientId);
          }

          // Retry request once
          const retryRes = await fetch(url, { ...fetchOptions, headers });
          const retryText = await retryRes.text().catch(() => '');
          let retryData: any = null;
          try {
            if (retryText) retryData = JSON.parse(retryText);
          } catch {}

          const latencyMs = Date.now() - startTime;
          return {
            ok: retryRes.ok,
            status: retryRes.status,
            data: retryData,
            rawText: retryText,
            error: retryRes.ok ? undefined : this.extractErrorMessage(retryRes.status, retryData, retryText),
            retried: true,
            latencyMs,
          };
        }
      } catch (retryErr: any) {
        console.warn('[DhanApiClient] Automatic token refresh retry failed:', retryErr.message);
      }
    }

    const latencyMs = Date.now() - startTime;
    return {
      ok: response.ok,
      status: response.status,
      data: parsedData,
      rawText,
      error: response.ok ? undefined : this.extractErrorMessage(response.status, parsedData, rawText),
      retried: false,
      latencyMs,
    };
  }

  private extractErrorMessage(status: number, data: any, rawText: string): string {
    if (data) {
      if (data.errorMessage) return data.errorMessage;
      if (data.remarks) return data.remarks;
      if (data.message) return data.message;
      if (data.error) return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    }
    return `Dhan responded with HTTP ${status}: ${rawText.slice(0, 200) || 'Unknown error'}`;
  }
}

// Global Singleton Instance
export const dhanApiClient = new DhanApiClient();
