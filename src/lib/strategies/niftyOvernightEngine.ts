/**
 * QUANTPULSE — NIFTY 09:20 Premium 62.5 Overnight Strategy Engine
 * Strategy ID: NIFTY_0920_PREMIUM_625_OVERNIGHT
 * 
 * CORE INVARIANT: NO TARGET PRICE.
 * There are only TWO exit conditions:
 *   1. Stop Loss is hit (Current Price <= 09:20 Ref Price * 0.75) -> SELL immediately
 *   2. Stop Loss is NOT hit -> HOLD overnight and SELL at 09:25 AM on next valid trading day
 */

import { NiftyOptionLeg, NiftyOvernightState, NiftyOvernightStatus } from '../types/quant';
import { getISTDate } from '../services/marketHoursService';
import { getNextValidTradingDay } from '../services/tradingCalendarService';

export const STRATEGY_ID = 'NIFTY_0920_PREMIUM_625_OVERNIGHT';
export const IDEAL_PREMIUM = 62.50;
export const MIN_ELIGIBLE_PREMIUM = 50.00;
export const MAX_ELIGIBLE_PREMIUM = 75.00;
export const STOP_LOSS_MULTIPLIER = 0.75; // 25% loss from 09:20 reference price
export const NIFTY_LOT_SIZE = 75; // Standard NSE NIFTY contract lot size

export interface RawOptionContract {
  type: 'CE' | 'PE';
  strike: number;
  expiry: string;
  price: number;
  symbol: string;
  openInterest?: number;
  volume?: number;
}

export interface ExpiryResolution {
  selectedExpiry: string;
  isExpiryOverride: boolean;
  availableExpiries: string[];
}

/**
 * Normalizes an expiry date string (e.g. "08-Oct-2026" or "2026-10-08") to uppercase "DD-MMM-YYYY".
 */
export function formatExpiryToStandard(d: Date): string {
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = monthNames[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Generates the upcoming valid NIFTY 50 weekly expiry dates starting from reference date.
 * Typically weekly expiries fall on Thursdays (or preceding Wednesday if Thursday is an exchange holiday).
 */
export function getUpcomingNiftyExpiries(refDate?: Date): string[] {
  const ist = getISTDate(refDate);
  const expiries: string[] = [];
  const testDate = new Date(ist.istDate.getTime());

  // Find next 4 Thursdays
  for (let i = 0; i < 28; i++) {
    // 4 = Thursday
    if (testDate.getUTCDay() === 4) {
      expiries.push(formatExpiryToStandard(testDate));
      if (expiries.length >= 4) break;
    }
    testDate.setUTCDate(testDate.getUTCDate() + 1);
  }

  return expiries;
}

/**
 * Resolves the appropriate NIFTY option expiry according to the strategy rule:
 * - If today is expiry day: SKIP today's expiry and use next available expiry!
 * - If normal day: use nearest valid expiry.
 * Both CE and PE must use this same selected expiry.
 */
export function resolveNiftyExpiry(currentDateStr: string, availableExpiries?: string[]): ExpiryResolution {
  const expiries = availableExpiries && availableExpiries.length > 0 
    ? availableExpiries 
    : getUpcomingNiftyExpiries();

  const nearestExpiry = expiries[0];

  // Compare calendar date of nearest expiry with current trading date
  const isTodayExpiry = isSameCalendarDate(currentDateStr, nearestExpiry);

  if (isTodayExpiry) {
    // Rule: Skip today's expiry, pick next available expiry
    const selectedExpiry = expiries.length > 1 ? expiries[1] : nearestExpiry;
    return {
      selectedExpiry,
      isExpiryOverride: true,
      availableExpiries: expiries,
    };
  }

  return {
    selectedExpiry: nearestExpiry,
    isExpiryOverride: false,
    availableExpiries: expiries,
  };
}

/**
 * Helper to check if a date string (YYYY-MM-DD or DD-MMM-YYYY) matches another expiry date.
 */
export function isSameCalendarDate(d1Str: string, d2Str: string): boolean {
  try {
    const d1 = new Date(d1Str);
    const d2 = new Date(d2Str);
    return (
      d1.getUTCFullYear() === d2.getUTCFullYear() &&
      d1.getUTCMonth() === d2.getUTCMonth() &&
      d1.getUTCDate() === d2.getUTCDate()
    );
  } catch {
    return d1Str.toUpperCase() === d2Str.toUpperCase();
  }
}

/**
 * Filters candidates between ₹50 and ₹75 inclusive, and selects the contract closest to ₹62.50.
 * Applied independently to CE and PE.
 */
export function filterAndSelectClosestOption(
  candidates: RawOptionContract[],
  type: 'CE' | 'PE'
): { selected: RawOptionContract | null; distance: number; allEligible: RawOptionContract[] } {
  // 1. Filter by contract type and price range [50.00, 75.00]
  const eligible = candidates.filter(
    (c) => c.type === type && c.price >= MIN_ELIGIBLE_PREMIUM && c.price <= MAX_ELIGIBLE_PREMIUM
  );

  if (eligible.length === 0) {
    return { selected: null, distance: 9999, allEligible: [] };
  }

  // 2. Find contract closest to IDEAL_PREMIUM (62.50)
  let best = eligible[0];
  let minDistance = Math.abs(best.price - IDEAL_PREMIUM);

  for (let i = 1; i < eligible.length; i++) {
    const dist = Math.abs(eligible[i].price - IDEAL_PREMIUM);
    if (dist < minDistance) {
      best = eligible[i];
      minDistance = dist;
    } else if (dist === minDistance) {
      // Deterministic tie-breaker: prefer higher strike or higher open interest
      if ((eligible[i].openInterest || 0) > (best.openInterest || 0)) {
        best = eligible[i];
      }
    }
  }

  return {
    selected: best,
    distance: +minDistance.toFixed(2),
    allEligible: eligible,
  };
}

/**
 * Calculates the fixed Stop Loss price for an option leg.
 * SL = reference_price_0920 * 0.75 (strictly 25% loss)
 * Rounded to 2 decimal places.
 */
export function calculateFixedStopLoss(referencePrice: number): number {
  return +(referencePrice * STOP_LOSS_MULTIPLIER).toFixed(2);
}

/**
 * Checks if the current market price has hit or breached the fixed Stop Loss.
 */
export function isStopLossHit(currentPrice: number, stopLossPrice: number): boolean {
  return currentPrice <= stopLossPrice;
}

/**
 * Generates the Unique Daily Execution ID:
 * Format: NIFTY_0920_PREMIUM_625_OVERNIGHT_YYYYMMDD
 */
export function getDailyExecutionId(dateStr?: string): string {
  const ist = getISTDate();
  const rawDate = dateStr || ist.dateStr;
  const compactDate = rawDate.replace(/-/g, '');
  return `${STRATEGY_ID}_${compactDate}`;
}

/**
 * Initializes a new blank or pending state for the strategy on day start.
 */
export function initializePendingState(dateStr?: string): NiftyOvernightState {
  const ist = getISTDate();
  const todayDate = dateStr || ist.dateStr;
  const dailyId = getDailyExecutionId(todayDate);
  const { selectedExpiry, isExpiryOverride } = resolveNiftyExpiry(todayDate);
  const nextTradingDay = getNextValidTradingDay(ist.istDate).dateStr;

  return {
    id: dailyId,
    tradingDate: todayDate,
    dailyExecutionId: dailyId,
    selectionTime: '09:20:00 IST',
    isTodayExpiry: isExpiryOverride,
    selectedExpiry,
    status: 'PENDING_SELECTION',
    nextTradingDay,
    mandatoryExitTime: '09:25:00 IST',
    ceLeg: {
      symbol: `NIFTY ${selectedExpiry} CE`,
      strike: 0,
      expiry: selectedExpiry,
      refPrice: 0,
      stopLoss: 0,
      currentPrice: 0,
      distance: 0,
      status: 'PENDING',
      quantity: NIFTY_LOT_SIZE,
    },
    peLeg: {
      symbol: `NIFTY ${selectedExpiry} PE`,
      strike: 0,
      expiry: selectedExpiry,
      refPrice: 0,
      stopLoss: 0,
      currentPrice: 0,
      distance: 0,
      status: 'PENDING',
      quantity: NIFTY_LOT_SIZE,
    },
  };
}

/**
 * Locks the 09:20 selection for both CE and PE legs.
 */
export function lock0920Selection(
  selectedCe: RawOptionContract,
  selectedPe: RawOptionContract,
  dateStr?: string
): NiftyOvernightState {
  const ist = getISTDate();
  const todayDate = dateStr || ist.dateStr;
  const dailyId = getDailyExecutionId(todayDate);
  const nextTradingDay = getNextValidTradingDay(ist.istDate).dateStr;

  const ceRef = selectedCe.price;
  const peRef = selectedPe.price;

  const ceSl = calculateFixedStopLoss(ceRef);
  const peSl = calculateFixedStopLoss(peRef);

  const ceDist = +Math.abs(ceRef - IDEAL_PREMIUM).toFixed(2);
  const peDist = +Math.abs(peRef - IDEAL_PREMIUM).toFixed(2);

  return {
    id: dailyId,
    tradingDate: todayDate,
    dailyExecutionId: dailyId,
    selectionTime: '09:20:00 IST',
    isTodayExpiry: isSameCalendarDate(todayDate, selectedCe.expiry),
    selectedExpiry: selectedCe.expiry,
    status: 'ACTIVE',
    nextTradingDay,
    mandatoryExitTime: '09:25:00 IST',
    ceLeg: {
      symbol: selectedCe.symbol || `NIFTY ${selectedCe.strike} CE`,
      strike: selectedCe.strike,
      expiry: selectedCe.expiry,
      refPrice: ceRef,
      stopLoss: ceSl,
      currentPrice: ceRef,
      distance: ceDist,
      status: 'ACTIVE',
      quantity: NIFTY_LOT_SIZE,
    },
    peLeg: {
      symbol: selectedPe.symbol || `NIFTY ${selectedPe.strike} PE`,
      strike: selectedPe.strike,
      expiry: selectedPe.expiry,
      refPrice: peRef,
      stopLoss: peSl,
      currentPrice: peRef,
      distance: peDist,
      status: 'ACTIVE',
      quantity: NIFTY_LOT_SIZE,
    },
  };
}
