// =====================================================================
// QUANTPULSE — Historical Lot Size Engine
// Part 25: getLotSize(underlying, tradingDate)
// Automatically maps historical NIFTY lot sizes across regulatory eras.
// =====================================================================

export interface LotSizeRule {
  underlying: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string;   // YYYY-MM-DD or '9999-12-31'
  lotSize: number;
}

export const HISTORICAL_NIFTY_LOT_SIZES: LotSizeRule[] = [
  // Era 1: Legacy era up to April 2021 -> 75
  { underlying: 'NIFTY', effectiveFrom: '2015-10-30', effectiveTo: '2021-04-29', lotSize: 75 },
  // Era 2: May 2021 to April 2024 -> 50
  { underlying: 'NIFTY', effectiveFrom: '2021-04-30', effectiveTo: '2024-04-25', lotSize: 50 },
  // Era 3: May 2024 to Nov 19, 2024 -> 25
  { underlying: 'NIFTY', effectiveFrom: '2024-04-26', effectiveTo: '2024-11-19', lotSize: 25 },
  // Era 4: Nov 20, 2024 onwards -> 75
  { underlying: 'NIFTY', effectiveFrom: '2024-11-20', effectiveTo: '9999-12-31', lotSize: 75 },
];

/**
 * Returns the exact historical lot size applicable for the specified underlying and date.
 * If underlying is NIFTY and date precedes known records, defaults to 75.
 * Never hard-codes the current lot size for historical dates.
 */
export function getLotSize(underlying: string, tradingDate: string): number {
  const normSymbol = (underlying || 'NIFTY').toUpperCase().trim();
  const dateStr = tradingDate.split('T')[0];

  if (normSymbol === 'NIFTY') {
    for (const rule of HISTORICAL_NIFTY_LOT_SIZES) {
      if (dateStr >= rule.effectiveFrom && dateStr <= rule.effectiveTo) {
        return rule.lotSize;
      }
    }
    // Default fallback for NIFTY
    return 75;
  }

  if (normSymbol === 'BANKNIFTY') {
    if (dateStr >= '2024-11-20') return 30;
    if (dateStr >= '2023-07-01') return 15;
    return 25;
  }

  return 50; // generic fallback
}
