// =====================================================================
// QUANTPULSE — Core TypeScript Type Definitions
// =====================================================================

export type InstrumentMode = 'STOCK' | 'OPTION';
export type ExecutionMode = 'MANUAL' | 'AUTO';

export interface Stock {
  ticker: string;
  name: string;
  isFnO: boolean;
  lotSize: number;
  strikeStep: number;
  spotLtp: number;
  todayVolM: number;
  avgVol20DM: number;
  hasCrossed20D: boolean;
  crossoverTime: string | null;
  crossoverSpotPrice: number | null;
  ivPct: number;
  justCrossedHighlight?: boolean;
  dayHigh?: number;
  dayLow?: number;
  dayOpen?: number;
  dayClose?: number;
  changePct?: number;
  feedSource?: 'LIVE_DHAN' | 'SIMULATED';
}

export interface CrossoverEvent {
  id?: string;
  ticker: string;
  time: string;
  avgVol20DM: number;
  crossPrice: number;
  isFnO: boolean;
}

export interface Position {
  id: string;
  orderTime: string;
  crossoverTime: string;
  ticker: string;
  executionMode: ExecutionMode;
  instrumentType: string;
  symbol: string;
  quantity: number;
  lots?: number | null;
  entryPrice: number;
  currentLtp: number;
  riskPerUnit: number;
  activeTrailingSl: number;
  targetPrice: number;
  stateIndex: 1 | 2 | 3 | 4; // 1: Initial SL (1R), 2: Breakeven, 3: +2R Trail, 4: Closed
  stateLabel: string;
}

export interface SystemConfig {
  instrumentMode: InstrumentMode;
  executionMode: ExecutionMode;
  capitalPerTrade: number;
  maxOpenPositions: number;
}

export interface VolumeMetrics {
  progressPct: number;
  rvolRatio: number;
  deficitM: number;
  isEligibleForBuy: boolean;
  statusCode: 'ELIGIBLE_FOR_BUY' | 'TRACKING_VOLUME';
  statusBadge: string;
}

export interface StockBuyDetails {
  instrumentType: string;
  symbol: string;
  action: 'BUY';
  entryPrice: number;
  quantity: number;
  riskPerShare: number;
  stopLossPrice: number;
  targetPrice: number;
  capitalRequired: number;
}

export interface OptionBuyDetails {
  instrumentType: string;
  symbol: string;
  optionType: 'CE';
  strikePrice: number;
  expiry: string;
  action: 'BUY';
  entryPrice: number;
  lotSize: number;
  lots: number;
  quantity: number;
  delta: number;
  ivPct: number;
  riskPerUnit: number;
  stopLossPrice: number;
  targetPrice: number;
  capitalRequired: number;
}

export interface NextActionPayload {
  ticker: string;
  eligibilityStatus: string;
  isEligibleForBuy: boolean;
  volumeTracking: {
    todayVolumeM: number;
    avgVolume20DM: number;
    crossoverProgressPct: number;
    rvolRatio: number;
    remainingDeficitM: number;
    exactCrossoverTime: string;
    crossoverSpotPrice: number | null;
    currentSpotLtp: number;
  };
  toggleConfiguration: {
    toggle1_Instrument: InstrumentMode;
    effectiveInstrumentMode: string;
    toggle2_Execution: ExecutionMode;
  };
  stockBuyDetails: StockBuyDetails;
  optionBuyDetails: OptionBuyDetails | null;
}
