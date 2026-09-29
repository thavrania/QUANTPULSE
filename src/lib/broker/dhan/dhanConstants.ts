// =====================================================================
// QUANTPULSE — Dhan HQ API Constants & Security ID Registry
// Source: Dhan Open API Scrip Master
// =====================================================================

export const DHAN_BASE_URL = 'https://api.dhan.co/v2';
export const DHAN_WS_FEED_URL = 'wss://api-feed.dhan.co';

/**
 * Pre-mapped Dhan Security IDs for major liquid stocks.
 * These correspond to official Dhan SEM_SMST_SECURITY_ID values for NSE Equity.
 */
export const DHAN_SECURITY_MAP: Record<string, { securityId: string; segment: string; lotSize: number; strikeStep: number }> = {
  RELIANCE: { securityId: '1330', segment: 'NSE_EQ', lotSize: 250, strikeStep: 50 },
  TATAMOTORS: { securityId: '3456', segment: 'NSE_EQ', lotSize: 550, strikeStep: 20 },
  TCS: { securityId: '11536', segment: 'NSE_EQ', lotSize: 175, strikeStep: 50 },
  INFY: { securityId: '1594', segment: 'NSE_EQ', lotSize: 400, strikeStep: 20 },
  HDFCBANK: { securityId: '1333', segment: 'NSE_EQ', lotSize: 550, strikeStep: 20 },
  ICICIBANK: { securityId: '4963', segment: 'NSE_EQ', lotSize: 700, strikeStep: 20 },
  SBIN: { securityId: '3045', segment: 'NSE_EQ', lotSize: 750, strikeStep: 10 },
  BHARTIARTL: { securityId: '10604', segment: 'NSE_EQ', lotSize: 475, strikeStep: 20 },
  KOTAKBANK: { securityId: '1922', segment: 'NSE_EQ', lotSize: 400, strikeStep: 20 },
  LT: { securityId: '11483', segment: 'NSE_EQ', lotSize: 150, strikeStep: 50 },
  ZOMATO: { securityId: '5097', segment: 'NSE_EQ', lotSize: 1, strikeStep: 5 },
};

export function getDhanSecurityId(ticker: string): string {
  const normalized = ticker.trim().toUpperCase();
  return DHAN_SECURITY_MAP[normalized]?.securityId || '1330';
}
