// =====================================================================
// QUANTPULSE — Indian Costs & Slippage Engine
// Parts 22, 23, 24: Slippage, Brokerage, Taxes & P&L Calculations
// =====================================================================

import { StrategyConfiguration } from './types';

export interface ExecutionFill {
  rawPrice: number;
  slippageApplied: number;
  effectivePrice: number;
}

export interface CostBreakdown {
  brokerage: number;
  stt: number;
  exchangeCharges: number;
  gst: number;
  sebiCharges: number;
  stampDuty: number;
  totalCosts: number;
}

export interface PnlSummary {
  grossPoints: number;
  grossPnl: number;
  slippageCostTotal: number;
  costs: CostBreakdown;
  netPnl: number;
  returnPercentage: number;
}

/**
 * Calculates effective execution price after applying configured slippage.
 * For buying: slippage increases entry price (worse fill).
 * For selling: slippage decreases exit price (worse fill).
 */
export function applySlippage(
  price: number,
  side: 'BUY' | 'SELL',
  config: StrategyConfiguration
): ExecutionFill {
  if (config.slippageMode === 'NONE' || !config.slippageValue || config.slippageValue <= 0) {
    return { rawPrice: price, slippageApplied: 0, effectivePrice: price };
  }

  let slippageAmt = 0;
  if (config.slippageMode === 'POINTS') {
    slippageAmt = config.slippageValue;
  } else if (config.slippageMode === 'PERCENTAGE') {
    slippageAmt = +(price * (config.slippageValue / 100)).toFixed(2);
  }

  const effectivePrice = side === 'BUY'
    ? +(price + slippageAmt).toFixed(2)
    : Math.max(0.05, +(price - slippageAmt).toFixed(2));

  return {
    rawPrice: price,
    slippageApplied: slippageAmt,
    effectivePrice,
  };
}

/**
 * Calculates all official statutory Indian equity derivative transaction charges.
 */
export function calculateTransactionCosts(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  config: StrategyConfiguration
): CostBreakdown {
  const buyTurnover = entryPrice * quantity;
  const sellTurnover = exitPrice * quantity;
  const totalTurnover = buyTurnover + sellTurnover;

  // 1. Brokerage: flat per executed order (buy order + sell order = 2 orders)
  const brokerage = +(config.brokeragePerOrder * 2).toFixed(2);

  // 2. STT (Securities Transaction Tax): Applied on sell side of option premium
  // Standard NSE options rate: 0.0625% on sell turnover (0.1% if exercised)
  const stt = +(sellTurnover * config.sttRate).toFixed(2);

  // 3. Exchange Turnover Charges: 0.0505% on total turnover
  const exchangeCharges = +(totalTurnover * config.exchangeTurnoverRate).toFixed(2);

  // 4. SEBI Regulatory Turnover Fees: ₹10 per crore (0.000001)
  const sebiCharges = +(totalTurnover * config.sebiTurnoverRate).toFixed(2);

  // 5. GST: 18% on (Brokerage + Exchange Charges + SEBI Charges)
  const gstBase = brokerage + exchangeCharges + sebiCharges;
  const gst = +(gstBase * config.gstRate).toFixed(2);

  // 6. Stamp Duty: 0.003% on buy side only for options
  const stampDuty = +(buyTurnover * config.stampDutyRate).toFixed(2);

  const totalCosts = +(brokerage + stt + exchangeCharges + gst + sebiCharges + stampDuty).toFixed(2);

  return {
    brokerage,
    stt,
    exchangeCharges,
    gst,
    sebiCharges,
    stampDuty,
    totalCosts,
  };
}

/**
 * Calculates full P&L metrics for an option buying trade.
 */
export function calculatePnl(
  entryFill: ExecutionFill,
  exitFill: ExecutionFill,
  quantity: number,
  config: StrategyConfiguration
): PnlSummary {
  const grossPoints = +(exitFill.effectivePrice - entryFill.effectivePrice).toFixed(2);
  const grossPnl = +(grossPoints * quantity).toFixed(2);

  const slippageCostTotal = +(
    (entryFill.slippageApplied + exitFill.slippageApplied) * quantity
  ).toFixed(2);

  const costs = calculateTransactionCosts(
    entryFill.effectivePrice,
    exitFill.effectivePrice,
    quantity,
    config
  );

  const netPnl = +(grossPnl - costs.totalCosts).toFixed(2);
  const capitalDeployed = entryFill.effectivePrice * quantity;
  const returnPercentage = capitalDeployed > 0 ? +((netPnl / capitalDeployed) * 100).toFixed(2) : 0;

  return {
    grossPoints,
    grossPnl,
    slippageCostTotal,
    costs,
    netPnl,
    returnPercentage,
  };
}
