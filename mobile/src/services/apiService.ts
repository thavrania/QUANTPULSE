import { API_CONFIG } from '../config/apiConfig';
import { StockRadarItem, ActiveSessionItem } from '../types/mobile';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'qp_mobile_auth_token';

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveStoredToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {}
}

export async function clearStoredToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {}
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['Cookie'] = `qp_terminal_auth=${token}`;
  }

  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  const res = await fetch(url, { ...options, headers });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const apiService = {
  async login(username: string, password: string): Promise<{ success: boolean; user: any; message?: string }> {
    const data = await request<any>(API_CONFIG.ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe: true }),
    });
    return data;
  },

  async checkSession(): Promise<{ authenticated: boolean; killed?: boolean; user?: any; activeSessionsCount?: number }> {
    return request<any>(API_CONFIG.ENDPOINTS.SESSION);
  },

  async logout(): Promise<void> {
    await request<any>(API_CONFIG.ENDPOINTS.LOGOUT, { method: 'POST' }).catch(() => {});
    await clearStoredToken();
  },

  async getMarketSession(): Promise<{ success: boolean; stocks: StockRadarItem[] }> {
    return request<any>(API_CONFIG.ENDPOINTS.MARKET_SESSION);
  },

  async getActiveSessions(): Promise<{ success: boolean; activeCount: number; sessions: ActiveSessionItem[] }> {
    return request<any>(API_CONFIG.ENDPOINTS.SESSIONS_LIST);
  },

  async killSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    return request<any>(API_CONFIG.ENDPOINTS.SESSIONS_KILL, {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },

  async killAllOtherSessions(): Promise<{ success: boolean; killedCount: number; message: string }> {
    return request<any>(API_CONFIG.ENDPOINTS.SESSIONS_KILL, {
      method: 'POST',
      body: JSON.stringify({ killAllOthers: true }),
    });
  },

  async placeOrder(params: {
    ticker: string;
    strike: number;
    optionType: 'CE' | 'PE';
    quantity: number;
    price: number;
  }): Promise<{ success: boolean; orderId?: string; message: string }> {
    return request<any>(API_CONFIG.ENDPOINTS.PLACE_ORDER, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async squareOffAll(): Promise<{ success: boolean; squaredCount: number; message: string }> {
    return request<any>(API_CONFIG.ENDPOINTS.SQUARE_OFF, {
      method: 'POST',
      body: JSON.stringify({ reason: 'MOBILE_PANIC_KILL_SWITCH' }),
    });
  },
};
