// =====================================================================
// QUANTPULSE — NIFTY 09:30 ₹180 Premium Breakout Option Buying Strategy
// Strategy ID: NIFTY_0930_180_BREAKOUT
// Constants & Defaults
// =====================================================================

import { StrategyConfiguration } from './types';

export const STRATEGY_ID = 'NIFTY_0930_180_BREAKOUT';
export const STRATEGY_NAME = 'NIFTY 9:30 ₹180 Premium Breakout Option Buying Strategy';
export const STRATEGY_VERSION = '1.0.0';

export const DEFAULT_TARGET_PREMIUM = 180;
export const DEFAULT_STOP_LOSS_PREMIUM = 160;
export const DEFAULT_TARGET_PROFIT_PREMIUM = 220;

export const SELECTION_TIME = '09:25';
export const BREAKOUT_START_TIME = '09:30';
export const FORCE_EXIT_TIME = '09:45';

export const DEFAULT_STRATEGY_CONFIG: StrategyConfiguration = {
  strategyName: STRATEGY_ID,
  underlying: 'NIFTY',
  expiryType: 'WEEKLY',
  contractSelectionTime: SELECTION_TIME,
  targetPremium: DEFAULT_TARGET_PREMIUM,
  breakoutStartTime: BREAKOUT_START_TIME,
  stopLoss: DEFAULT_STOP_LOSS_PREMIUM,
  target: DEFAULT_TARGET_PROFIT_PREMIUM,
  forceExitTime: FORCE_EXIT_TIME,
  maxTradesPerDay: 1,
  timeframe: '1m',
  strikeSelection: 'CLOSEST_PREMIUM',
  referencePriceMode: 'CLOSE',
  stopLossMode: 'FIXED_PREMIUM',
  targetMode: 'FIXED_PREMIUM',
  sameTimestampResolution: 'NO_TRADE',
  entryExecutionMode: 'NEXT_CANDLE_OPEN',
  intrabarConflictMode: 'STOP_FIRST',
  slippageMode: 'NONE',
  slippageValue: 0,
  brokeragePerOrder: 20, // ₹20 flat per order (₹40 round trip)
  sttRate: 0.000625, // 0.0625% on sell turnover
  exchangeTurnoverRate: 0.000505, // 0.0505% NSE
  sebiTurnoverRate: 0.000001, // ₹10 per crore
  stampDutyRate: 0.00003, // 0.003% on buy side
  gstRate: 0.18, // 18% on brokerage + turnover
  quantityLots: 1,
};
