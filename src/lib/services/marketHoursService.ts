/**
 * Indian Market Hours & Session Awareness Engine (NSE / BSE)
 * Timezone: Asia/Kolkata (IST = UTC + 5:30)
 * Regular trading session: 09:15 IST to 15:30 IST, Monday through Friday
 */

export interface MarketSessionInfo {
  session: 'LIVE' | 'PRE_MARKET' | 'POST_MARKET' | 'CLOSED';
  isLiveTrading: boolean;
  statusLabel: string;
  badgeColor: 'emerald' | 'amber' | 'slate' | 'rose';
  currentIstTime: string;
  details: string;
  recommendedIntervalMs: number;
}

/**
 * Returns current Indian Standard Time (IST) details
 */
export function getISTDate(refDate?: Date): {
  istDate: Date;
  hours: number;
  minutes: number;
  seconds: number;
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  timeStr: string;
  dateStr: string;
} {
  const d = refDate || new Date();
  
  // Convert UTC to IST (+5.5 hours)
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const istOffsetMs = 5.5 * 3600000;
  const istDate = new Date(utcMs + istOffsetMs);

  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const seconds = istDate.getSeconds();
  const dayOfWeek = istDate.getDay();

  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const dateStr = `${istDate.getFullYear()}-${pad(istDate.getMonth() + 1)}-${pad(istDate.getDate())}`;

  return { istDate, hours, minutes, seconds, dayOfWeek, timeStr, dateStr };
}

/**
 * Calculates current market session state
 */
export function getIndianMarketSession(refDate?: Date): MarketSessionInfo {
  const { hours, minutes, seconds, dayOfWeek, timeStr } = getISTDate(refDate);

  // Check Weekend (Saturday or Sunday)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      session: 'CLOSED',
      isLiveTrading: false,
      statusLabel: 'WEEKEND CLOSED',
      badgeColor: 'rose',
      currentIstTime: `${timeStr} IST`,
      details: 'NSE closed for the weekend. Next live session starts Monday at 09:15 IST.',
      recommendedIntervalMs: 30000,
    };
  }

  const timeInMinutes = hours * 60 + minutes;
  const preMarketStart = 9 * 60; // 09:00
  const marketOpen = 9 * 60 + 15; // 09:15
  const marketClose = 15 * 60 + 30; // 15:30
  const postMarketClose = 16 * 60; // 16:00

  // 1. Regular Trading Session: 09:15 to 15:30 IST
  if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
    return {
      session: 'LIVE',
      isLiveTrading: true,
      statusLabel: 'LIVE MARKET OPEN',
      badgeColor: 'emerald',
      currentIstTime: `${timeStr} IST`,
      details: 'Active NSE trading session (09:15 – 15:30 IST). Real-time ticks streaming.',
      recommendedIntervalMs: 2000, // 2-second high-speed pulse
    };
  }

  // 2. Pre-Market Session: 09:00 to 09:15 IST
  if (timeInMinutes >= preMarketStart && timeInMinutes < marketOpen) {
    return {
      session: 'PRE_MARKET',
      isLiveTrading: false,
      statusLabel: 'PRE-MARKET SESSION',
      badgeColor: 'amber',
      currentIstTime: `${timeStr} IST`,
      details: 'NSE Pre-market order collection & price discovery. Live trading opens at 09:15 IST.',
      recommendedIntervalMs: 8000,
    };
  }

  // 3. Post-Market Closing: 15:30 to 16:00 IST
  if (timeInMinutes >= marketClose && timeInMinutes < postMarketClose) {
    return {
      session: 'POST_MARKET',
      isLiveTrading: false,
      statusLabel: 'POST-MARKET CLOSING',
      badgeColor: 'amber',
      currentIstTime: `${timeStr} IST`,
      details: 'NSE Post-market settlement session. Final closing prices calculated.',
      recommendedIntervalMs: 15000,
    };
  }

  // 4. Closed (Night / Off-hours)
  return {
    session: 'CLOSED',
    isLiveTrading: false,
    statusLabel: 'MARKET CLOSED',
    badgeColor: 'rose',
    currentIstTime: `${timeStr} IST`,
    details: 'NSE is currently closed. Next live trading session opens tomorrow at 09:15 IST.',
    recommendedIntervalMs: 30000,
  };
}
