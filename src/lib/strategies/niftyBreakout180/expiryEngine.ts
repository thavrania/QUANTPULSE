// =====================================================================
// QUANTPULSE — Expiry Resolution Engine
// Part 4: getTargetExpiry(tradingDate, underlying, expiryConfiguration)
// Dedicated dynamic weekly expiry resolver. Never hard-codes expiry dates.
// =====================================================================

import { isTradingDay, NSE_MARKET_HOLIDAYS } from '../../services/marketHoursService';

export interface ExpiryConfiguration {
  expiryType?: 'WEEKLY' | 'MONTHLY';
  availableExpiries?: string[]; // If data provider provides known expiries
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Standardizes a date into YYYY-MM-DD.
 */
export function formatToIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Resolves the target weekly/monthly expiry applicable to the trading date.
 * If availableExpiries is provided, selects the nearest valid expiry on or after tradingDate.
 * Otherwise, calculates dynamically by looking for upcoming Thursday (NSE Weekly Expiry),
 * stepping backward if the expiry falls on an exchange holiday.
 */
export function getTargetExpiry(
  tradingDate: string,
  underlying: string = 'NIFTY',
  expiryConfiguration?: ExpiryConfiguration
): string {
  const normDateStr = tradingDate.split('T')[0];
  const available = expiryConfiguration?.availableExpiries;

  if (available && available.length > 0) {
    // Filter to expiries on or after tradingDate and sort ascending
    const validFutureExpiries = available
      .filter((exp) => exp >= normDateStr)
      .sort((a, b) => a.localeCompare(b));

    if (validFutureExpiries.length > 0) {
      return validFutureExpiries[0];
    }
  }

  // Dynamic Calculation:
  // NIFTY Weekly options historically and currently expire on Thursdays (Day 4).
  // If Thursday is a trading holiday, expiry shifts to Wednesday (preceding trading day).
  const [year, month, day] = normDateStr.split('-').map(Number);
  const cur = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

  // Find next Thursday (day 4) on or after cur
  const target = new Date(cur.getTime());
  const currentDayOfWeek = target.getUTCDay();
  const daysUntilThursday = (4 - currentDayOfWeek + 7) % 7;
  target.setUTCDate(target.getUTCDate() + daysUntilThursday);

  // If target is a weekend or holiday, walk backwards to previous valid trading day
  while (true) {
    const iso = formatToIsoDate(target);
    const dayOfWeek = target.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = !!NSE_MARKET_HOLIDAYS[iso];

    if (!isWeekend && !isHoliday) {
      break;
    }
    // Walk back 1 day
    target.setUTCDate(target.getUTCDate() - 1);
  }

  return formatToIsoDate(target);
}
