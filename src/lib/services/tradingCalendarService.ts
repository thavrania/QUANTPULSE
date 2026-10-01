/**
 * QUANTPULSE — Trading Calendar Service
 * Calculates the next valid NSE / BSE trading day, skipping weekends and official exchange holidays.
 */

import { getISTDate, isTradingDay } from './marketHoursService';

export interface NextTradingDayResult {
  dateStr: string; // YYYY-MM-DD
  dayName: string; // Monday, Tuesday, etc.
  istDate: Date;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Calculates the next valid trading day starting after the specified reference date.
 * If fromDate is not provided, uses current IST date.
 * Does NOT simply add 1 calendar day. Skips Saturdays, Sundays, and official exchange holidays.
 */
export function getNextValidTradingDay(fromDate?: Date): NextTradingDayResult {
  const baseIst = getISTDate(fromDate);
  // Start from next calendar day
  const testDate = new Date(baseIst.istDate.getTime());
  testDate.setUTCDate(testDate.getUTCDate() + 1);

  // Maximum search horizon: 14 days
  for (let i = 0; i < 14; i++) {
    const { isTradingDay: validDay } = isTradingDay(testDate);
    if (validDay) {
      const ist = getISTDate(testDate);
      return {
        dateStr: ist.dateStr,
        dayName: DAY_NAMES[ist.dayOfWeek],
        istDate: testDate,
      };
    }
    testDate.setUTCDate(testDate.getUTCDate() + 1);
  }

  // Fallback (should never be reached under ordinary circumstances)
  const fallback = getISTDate(testDate);
  return {
    dateStr: fallback.dateStr,
    dayName: DAY_NAMES[fallback.dayOfWeek],
    istDate: testDate,
  };
}

/**
 * Checks whether the specified date (or today in IST) is an active NSE trading day.
 */
export function isNseTradingDay(date?: Date): boolean {
  return isTradingDay(date).isTradingDay;
}
