// =====================================================================
// QUANTPULSE — Core TypeScript Type Definitions
// =====================================================================

export type InstrumentMode = 'STOCK' | 'OPTION';
export type ExecutionMode = 'MANUAL' | 'AUTO';

export interface Stock {
  ticker: string; // NSE Symbol / Ticker (e.g. TCS, RELIANCE)
  shortName?: string; // Market Short Name (e.g. Reliance, TCS, HDFC Bank, ICICI Bank)
  name: string; // Exact Registered Real Market Company Name (e.g. Reliance Industries Limited)
  isFnO: boolean;
  segment?: 'NSE_FNO' | 'NSE_EQ' | string;
  sector?: string; // Industry sector (e.g. IT Services, Banking)
  securityId?: string; // Dhan Official Security ID
  isin?: string; // International Securities Identification Number (e.g. INE002A01018)
  lotSize: number;
  strikeStep: number;
  spotLtp: number;
  todayVolM: number; // Cumulative Traded Shares today (in Millions)
  avgVol20DM: number; // 20-Day Average Traded Shares (in Millions)
  todayTradedShares?: number; // Exact count of shares traded today
  avg20DTradedShares?: number; // Exact count of 20-day average traded shares
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
  indices?: string[];
}

export interface StockMasterItem {
  ticker: string; // Official NSE Trading Symbol (e.g. RELIANCE, TCS)
  shortName?: string; // Real Market Short Name (e.g. Reliance, TCS, HDFC Bank, ICICI Bank)
  name: string; // Exact Legal Registered Name (e.g. Reliance Industries Limited)
  segment: 'NSE_FNO' | 'NSE_EQ';
  exchange: 'NSE';
  sector: string;
  securityId: string;
  isin?: string;
  lotSize: number;
  strikeStep: number;
  avgVol20DM: number;
  avg20DTradedShares?: number; // Exact count of 20-day average traded shares
  approxLtp?: number;
  isFnO: boolean;
  indices?: string[];
}

export interface CrossoverEvent {
  id?: string;
  ticker: string;
  time: string;
  avgVol20DM: number;
  avg20DTradedShares?: number; // Exact count of 20-day average traded shares
  todayTradedShares?: number; // Exact count of shares traded at crossover
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
  buyValue?: number;
  buy_value?: number;
  piPct?: number;
  pi_pct?: number;
  target1?: number;
  target2?: number;
  target3?: number;
  target4?: number;
  target_1?: number;
  target_2?: number;
  target_3?: number;
  target_4?: number;
  highestTargetAchieved?: 'NONE' | 'T1' | 'T2' | 'T3' | 'T4';
  highest_target_achieved?: 'NONE' | 'T1' | 'T2' | 'T3' | 'T4';
  targetAchievementTimestamp?: string | null;
  target_achievement_time?: string | null;
  strategyId?: string;
  strategy_id?: string;
  allowOvernight?: boolean;
  allow_overnight?: boolean;
  referencePrice?: number;
  reference_price?: number;
  nextTradingDay?: string;
  next_trading_day?: string;
}

export interface SystemConfig {
  instrumentMode: InstrumentMode;
  executionMode: ExecutionMode;
  capitalPerTrade: number;
  maxOpenPositions: number;
}

export type VolumeStatusCode = 'ELIGIBLE_FOR_BUY' | 'TRACKING_VOLUME' | 'HIGH_VOL_BEARISH';

export interface VolumeMetrics {
  progressPct: number;
  rvolRatio: number;
  deficitM: number;
  deficitShares?: number;
  surplusShares?: number;
  isEligibleForBuy: boolean;
  statusCode: VolumeStatusCode;
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

export interface TradeLog {
  id?: string;
  order_id: string;
  ticker: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  instrument_type: string;
  routing_mode: 'PAPER' | 'LIVE_DHAN';
  quantity: number;
  lots?: number | null;
  entry_price: number;
  exit_price?: number | null;
  stop_loss: number;
  target_price: number;
  realized_pnl?: number;
  crossover_ref_time: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  closed_at?: string | null;
  created_at?: string;
  buy_value?: number;
  pi_pct?: number;
  target_1?: number;
  target_2?: number;
  target_3?: number;
  target_4?: number;
  highest_target_achieved?: 'NONE' | 'T1' | 'T2' | 'T3' | 'T4';
  target_achievement_time?: string | null;
  strategy_id?: string;
  reference_price?: number;
  exit_reason?: string;
}

export interface TargetPerformanceReport {
  timeframe: 'DAILY' | 'WEEKLY' | 'YEARLY';
  totalTrades: number;
  t1AchievedCount: number;
  t2AchievedCount: number;
  t3AchievedCount: number;
  t4AchievedCount: number;
  highestTargetAchieved: 'NONE' | 'T1' | 'T2' | 'T3' | 'T4';
  noTargetTradesCount: number;
  grossPnl: number;
  targetAchievementPercentage: number;
}

export interface TslAuditTrailEntry {
  id?: string;
  position_id: string;
  symbol: string;
  from_state: number;
  to_state: number;
  from_label: string;
  to_label: string;
  spot_price_at_transition: number;
  option_ltp_at_transition?: number;
  new_trailing_sl: number;
  pnl_locked: number;
  timestamp_ist: string;
  created_at?: string;
}

export interface DailyPnlJournal {
  trading_date: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate_pct: number;
  gross_realized_pnl: number;
  max_drawdown: number;
  symbols_traded: string[];
  notes?: string;
  created_at?: string;
}

export interface LiveTickSnapshot {
  id?: string;
  ticker: string;
  timestamp_ist: string;
  spot_ltp: number;
  today_vol_m: number;
  avg_vol_20d_m: number;
  rvol_ratio: number;
  created_at?: string;
}

export interface BrokerVaultEntry {
  id?: string;
  broker_name: string;
  client_id: string;
  access_token: string;
  token_generated_at?: string;
  token_expiry_at: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  last_ping_latency_ms?: number;
  available_margin?: number;
  is_primary?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BrokerVaultStatus {
  isConfigured: boolean;
  brokerName: string;
  clientId: string;
  maskedToken: string;
  tokenExpiryAt: string | null;
  tokenTimeRemaining: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  lastLatencyMs?: number | null;
  availableMargin?: number | null;
  source: 'VAULT' | 'LOCAL' | 'ENV' | 'NONE';
}

export interface DhanAuthStatus {
  isConfigured: boolean;
  authMode: 'AUTOMATED_API_KEY_TOTP' | 'MANUAL_VAULT' | 'ENV_STATIC' | 'NONE';
  tokenValid: boolean;
  isExpiringSoon: boolean;
  timeRemainingFormatted: string;
  remainingMinutes: number;
  maskedClientId: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasTotpSecret: boolean;
  lastRefreshedAt: string | null;
  tokenExpiryAt: string | null;
  source: string;
  lastError: string | null;
}

// =====================================================================
// NIFTY 09:20 Premium 62.5 Overnight Strategy Domain Types
// Strategy ID: NIFTY_0920_PREMIUM_625_OVERNIGHT
// =====================================================================

export type NiftyOvernightStatus =
  | 'PENDING_SELECTION'
  | 'SELECTED'
  | 'ACTIVE'
  | 'SL_HIT'
  | 'OVERNIGHT_HOLD'
  | 'NEXT_DAY_0925_EXIT'
  | 'NEXT_DAY_0925_EXIT_RECOVERY'
  | 'CLOSED'
  | 'NO_ELIGIBLE_OPTION'
  | 'ERROR';

export interface NiftyOptionLeg {
  symbol: string;
  strike: number;
  expiry: string;
  refPrice: number;
  stopLoss: number;
  currentPrice: number;
  distance: number;
  status: 'PENDING' | 'ACTIVE' | 'SL_HIT' | 'OVERNIGHT_HOLD' | 'CLOSED';
  quantity: number;
  exitPrice?: number | null;
  exitTime?: string | null;
  exitReason?: string | null;
  realizedPnl?: number;
}

export interface NiftyOvernightState {
  id: string;
  tradingDate: string;
  dailyExecutionId: string;
  selectionTime: string;
  isTodayExpiry: boolean;
  selectedExpiry: string;
  status: NiftyOvernightStatus;
  nextTradingDay: string;
  mandatoryExitTime: string;
  ceLeg: NiftyOptionLeg;
  peLeg: NiftyOptionLeg;
}

export interface CentralMarketSnapshot {
  ticker: string;
  securityId?: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  changePct: number;
  todayTradedShares: number;
  todayVolumeM: number;
  avgVol20DM: number;
  avg20DTradedShares: number;
  averagePrice?: number;
  lastTradeTime?: string;
  source: string;
  feedStatus: string;
  hasCrossed20D?: boolean;
  crossoverTime?: string | null;
  crossoverSpotPrice?: number | null;
  timestampIst?: string;
  receivedAt: string;
  updatedAt: string;
}

export type FeedHealthStatus = 'CONNECTED' | 'DEGRADED' | 'FALLBACK' | 'DISCONNECTED' | 'SIMULATION';

export interface CentralFeedHealth {
  status: FeedHealthStatus;
  source: string;
  lastSuccessfulUpdate: string | null;
  latencyMs: number;
  errorCount: number;
  lastError: string | null;
  workerId?: string;
  activeSubscribers?: number;
  updatedAt: string;
}

export interface LiveQuoteRecord {
  ltp: number;
  volumeM: number;
  volume?: number; // Exact count of physical traded shares today
  high: number;
  low: number;
  open: number;
  close: number;
  changePct: number;
  averagePrice?: number;
}
