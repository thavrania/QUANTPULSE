// QuantPulse Backend API Configuration
// In Android emulator, 10.0.2.2 refers to host PC localhost.
// When testing on a physical phone on the same Wi-Fi, replace with your PC local IP (e.g., http://192.168.1.100:3000)
export const API_CONFIG = {
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000',
  ENDPOINTS: {
    LOGIN: '/api/auth/login',
    SESSION: '/api/auth/session',
    LOGOUT: '/api/auth/logout',
    SESSIONS_LIST: '/api/auth/sessions',
    SESSIONS_KILL: '/api/auth/sessions/kill',
    MARKET_SESSION: '/api/pipeline/market-session',
    PLACE_ORDER: '/api/broker/dhan/place-order',
    SQUARE_OFF: '/api/broker/dhan/square-off',
    BROKER_VAULT: '/api/broker/vault',
  },
  POLL_INTERVAL_MS: 4000,
  HEARTBEAT_INTERVAL_MS: 5000,
};
