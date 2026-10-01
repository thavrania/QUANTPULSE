/**
 * Indian Market Hours & Session Awareness Engine (NSE / BSE)
 * Timezone: Asia/Kolkata (IST = UTC + 5:30)
 * Regular trading session: 09:15 IST to 15:30 IST, Monday through Friday
 * Application live feed stop: 15:31 IST
 */

export interface MarketTimingConfig {
  preMarketOpenSeconds: number; // 09:00:00 -> 32400
  marketOpenSeconds: number;    // 09:15:00 -> 33300
  marketCloseSeconds: number;   // 15:30:00 -> 55800
  feedStopSeconds: number;      // 15:31:00 -> 55860
}

export const DEFAULT_MARKET_TIMINGS: MarketTimingConfig = {
  preMarketOpenSeconds: 9 * 3600, // 09:00 IST
  marketOpenSeconds: 9 * 3600 + 15 * 60, // 09:15 IST
  marketCloseSeconds: 15 * 3600 + 30 * 60, // 15:30 IST
  feedStopSeconds: 15 * 3600 + 31 * 60, // 15:31 IST
};

export interface MarketSessionInfo {
  session: 'LIVE' | 'PRE_MARKET' | 'POST_MARKET' | 'CLOSED';
  isLiveTrading: boolean;
  statusLabel: string;
  badgeColor: 'emerald' | 'amber' | 'slate' | 'rose';
  currentIstTime: string;
  details: string;
  recommendedIntervalMs: number;
  isHoliday?: boolean;
  holidayName?: string;
}

/**
 * Standard Indian Equity Market (NSE / BSE) Official Holidays.
 * Format: YYYY-MM-DD
 */
export const NSE_MARKET_HOLIDAYS: Record<string, string> = {
  // 2025 Holidays
  '2025-01-26': 'Republic Day',
  '2025-02-26': 'Mahashivratri',
  '2025-03-14': 'Holi',
  '2025-03-31': 'Id-Ul-Fitr (Ramzan Id)',
  '2025-04-10': 'Mahavir Jayanti',
  '2025-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2025-04-18': 'Good Friday',
  '2025-05-01': 'Maharashtra Day',
  '2025-06-07': 'Bakri Id / Eid-ul-Adha',
  '2025-08-15': 'Independence Day',
  '2025-08-27': 'Ganesh Chaturthi',
  '2025-10-02': 'Mahatma Gandhi Jayanti',
  '2025-10-21': 'Diwali Laxmi Pujan (Muhurat Trading only)',
  '2025-10-22': 'Diwali Balipratipada',
  '2025-11-05': 'Prakash Gurpurb Sri Guru Nanak Dev',
  '2025-12-25': 'Christmas',

  // 2026 Holidays
  '2026-01-26': 'Republic Day',
  '2026-02-15': 'Mahashivratri',
  '2026-03-03': 'Holi',
  '2026-03-20': 'Id-Ul-Fitr',
  '2026-03-31': 'Mahavir Jayanti',
  '2026-04-03': 'Good Friday',
  '2026-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2026-05-01': 'Maharashtra Day',
  '2026-05-27': 'Bakri Id / Eid-ul-Adha',
  '2026-08-15': 'Independence Day',
  '2026-09-15': 'Ganesh Chaturthi',
  '2026-10-02': 'Mahatma Gandhi Jayanti',
  '2026-10-20': 'Dussehra',
  '2026-11-08': 'Diwali Laxmi Pujan',
  '2026-11-09': 'Diwali Balipratipada',
  '2026-11-24': 'Guru Nanak Jayanti',
  '2026-12-25': 'Christmas',

  // 2027 Holidays
  '2027-01-26': 'Republic Day',
  '2027-03-06': 'Mahashivratri',
  '2027-03-22': 'Holi',
  '2027-03-26': 'Good Friday',
  '2027-04-14': 'Dr. Ambedkar Jayanti',
  '2027-05-01': 'Maharashtra Day',
  '2027-08-15': 'Independence Day',
  '2027-10-02': 'Mahatma Gandhi Jayanti',
  '2027-12-25': 'Christmas',
};

/**
 * High-precision cross-timezone conversion to Asia/Kolkata (IST = UTC + 05:30)
 * India operates on a permanent, fixed UTC+05:30 offset with zero Daylight Saving Time (DST).
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
  const istOffsetMs = 5.5 * 3600 * 1000;
  const istTimeMs = d.getTime() + istOffsetMs;
  const istDate = new Date(istTimeMs);

  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  const seconds = istDate.getUTCSeconds();
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  const dayOfWeek = istDate.getUTCDay();

  const pad = (n: number) => String(n).padStart(2, '0');
  const timeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const dateStr = `${year}-${month}-${day}`;

  return { istDate, hours, minutes, seconds, dayOfWeek, timeStr, dateStr };
}

/**
 * Checks if a specific date string (YYYY-MM-DD) is an official NSE trading holiday.
 */
export function checkNseHoliday(dateStr: string): { isHoliday: boolean; holidayName?: string } {
  // Allow user override from localStorage if available
  if (typeof window !== 'undefined') {
    try {
      const customHolidays = localStorage.getItem('qp_custom_nse_holidays');
      if (customHolidays) {
        const parsed = JSON.parse(customHolidays);
        if (parsed[dateStr]) {
          return { isHoliday: true, holidayName: parsed[dateStr] };
        }
      }
    } catch {}
  }

  if (NSE_MARKET_HOLIDAYS[dateStr]) {
    return { isHoliday: true, holidayName: NSE_MARKET_HOLIDAYS[dateStr] };
  }
  return { isHoliday: false };
}

/**
 * Validates whether today is an active trading session day (Monday through Friday, non-holiday).
 */
export function isTradingDay(refDate?: Date): { isTradingDay: boolean; reason?: string } {
  const { dayOfWeek, dateStr } = getISTDate(refDate);

  if (dayOfWeek === 0) {
    return { isTradingDay: false, reason: 'Sunday — Market Closed' };
  }
  if (dayOfWeek === 6) {
    return { isTradingDay: false, reason: 'Saturday — Market Closed' };
  }

  const holidayCheck = checkNseHoliday(dateStr);
  if (holidayCheck.isHoliday) {
    return { isTradingDay: false, reason: `Market Holiday: ${holidayCheck.holidayName}` };
  }

  return { isTradingDay: true };
}

/**
 * Determines if today's regular NSE continuous trading session has already opened (>= 09:15 IST).
 */
export function hasTodayMarketSessionStarted(refDate?: Date, config: MarketTimingConfig = DEFAULT_MARKET_TIMINGS): boolean {
  const { isTradingDay: tradingDay } = isTradingDay(refDate);
  if (!tradingDay) return false;

  const { hours, minutes, seconds } = getISTDate(refDate);
  const nowSecs = hours * 3600 + minutes * 60 + seconds;
  return nowSecs >= config.marketOpenSeconds;
}

/**
 * Determines if the regular trading session has concluded for today (>= 15:30 IST).
 */
export function hasTodayMarketSessionEnded(refDate?: Date, config: MarketTimingConfig = DEFAULT_MARKET_TIMINGS): boolean {
  const { isTradingDay: tradingDay } = isTradingDay(refDate);
  if (!tradingDay) return true;

  const { hours, minutes, seconds } = getISTDate(refDate);
  const nowSecs = hours * 3600 + minutes * 60 + seconds;
  return nowSecs >= config.marketCloseSeconds;
}

/**
 * Determines if the application live feed should be completely stopped (>= 15:31 IST).
 */
export function shouldStopLiveFeed(refDate?: Date, config: MarketTimingConfig = DEFAULT_MARKET_TIMINGS): boolean {
  const { isTradingDay: tradingDay } = isTradingDay(refDate);
  if (!tradingDay) return true;

  const { hours, minutes, seconds } = getISTDate(refDate);
  const nowSecs = hours * 3600 + minutes * 60 + seconds;
  return nowSecs >= config.feedStopSeconds;
}

/**
 * Calculates current market session state based on IST and trading calendar.
 */
export function getIndianMarketSession(refDate?: Date, config: MarketTimingConfig = DEFAULT_MARKET_TIMINGS): MarketSessionInfo {
  const { hours, minutes, seconds, dayOfWeek, timeStr, dateStr } = getISTDate(refDate);
  const nowSecs = hours * 3600 + minutes * 60 + seconds;

  // 1. Weekend Check
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

  // 2. Official Holiday Check
  const holidayCheck = checkNseHoliday(dateStr);
  if (holidayCheck.isHoliday) {
    return {
      session: 'CLOSED',
      isLiveTrading: false,
      statusLabel: 'MARKET HOLIDAY',
      badgeColor: 'rose',
      currentIstTime: `${timeStr} IST`,
      details: `NSE closed today for ${holidayCheck.holidayName}.`,
      recommendedIntervalMs: 30000,
      isHoliday: true,
      holidayName: holidayCheck.holidayName,
    };
  }

  // 3. Regular Continuous Trading Session: 09:15 to 15:30 IST
  if (nowSecs >= config.marketOpenSeconds && nowSecs < config.marketCloseSeconds) {
    return {
      session: 'LIVE',
      isLiveTrading: true,
      statusLabel: 'LIVE MARKET OPEN',
      badgeColor: 'emerald',
      currentIstTime: `${timeStr} IST`,
      details: 'Active NSE continuous trading session (09:15 – 15:30 IST). Real-time ticks streaming.',
      recommendedIntervalMs: 2000, // 2-second pulse
    };
  }

  // 4. Pre-Market Session: 09:00 to 09:15 IST
  if (nowSecs >= config.preMarketOpenSeconds && nowSecs < config.marketOpenSeconds) {
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

  // 5. Post-Market Closing & Feed Shutdown Window: 15:30 to 16:00 IST
  if (nowSecs >= config.marketCloseSeconds && nowSecs < 16 * 3600) {
    const isShutdown = nowSecs >= config.feedStopSeconds;
    return {
      session: 'POST_MARKET',
      isLiveTrading: false,
      statusLabel: isShutdown ? 'MARKET CLOSED' : 'MARKET CLOSING',
      badgeColor: 'amber',
      currentIstTime: `${timeStr} IST`,
      details: isShutdown
        ? 'NSE trading session ended at 15:30 IST. Live feed stopped at 15:31 IST.'
        : 'NSE continuous trading ended at 15:30 IST. Closing feed and settling orders.',
      recommendedIntervalMs: 15000,
    };
  }

  // 6. Closed (Night / Off-hours)
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
