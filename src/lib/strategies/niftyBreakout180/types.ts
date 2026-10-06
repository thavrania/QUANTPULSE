// =====================================================================
// QUANTPULSE — NIFTY 09:30 ₹180 Premium Breakout Option Buying Strategy
// Strategy ID: NIFTY_0930_180_BREAKOUT
// Types and Domain Models
// =====================================================================

export type BreakoutStrategyState =
  | 'WAITING_FOR_925'
  | 'SELECT_CONTRACTS'
  | 'WAITING_FOR_930'
  | 'MONITORING_BREAKOUT'
  | 'CE_TRIGGERED'
  | 'PE_TRIGGERED'
  | 'POSITION_OPEN'
  | 'POSITION_EXITED'
  | 'DAY_COMPLETED';

export type ReferencePriceMode = 'CLOSE' | 'OPEN' | 'HIGH' | 'LOW' | 'MIDPRICE';

export type StopLossMode = 'FIXED_PREMIUM' | 'POINTS_FROM_ENTRY' | 'PERCENT_FROM_ENTRY';

export type TargetMode = 'FIXED_PREMIUM' | 'POINTS_FROM_ENTRY' | 'PERCENT_FROM_ENTRY';

export type SameTimestampResolution =
  | 'NO_TRADE'
  | 'CE_FIRST'
  | 'PE_FIRST'
  | 'HIGHER_MOMENTUM'
  | 'USE_INTRABAR_DATA';

export type EntryExecutionMode =
  | 'NEXT_CANDLE_OPEN'
  | 'CROSS_LEVEL'
  | 'CURRENT_CANDLE_CLOSE'
  | 'INTRABAR_ESTIMATE';

export type IntrabarConflictMode =
  | 'STOP_FIRST'
  | 'TARGET_FIRST'
  | 'NEXT_HIGHER_FREQUENCY_DATA'
  | 'AMBIGUOUS_EXIT';

export type SlippageMode = 'NONE' | 'POINTS' | 'PERCENTAGE';

export type NoTradeReason =
  | 'NO_CE_CONTRACT'
  | 'NO_PE_CONTRACT'
  | 'NO_VALID_925_DATA'
  | 'NO_BREAKOUT'
  | 'SIMULTANEOUS_BREAKOUT'
  | 'DATA_ERROR'
  | 'HOLIDAY'
  | 'MARKET_CLOSED'
  | 'DATA_INCOMPLETE';

export type ExitReason = 'SL_HIT' | 'TARGET_HIT' | 'TIME_EXIT' | 'AMBIGUOUS_EXIT' | string;

export interface StrategyConfiguration {
  strategyName: string;
  underlying: 'NIFTY' | string;
  expiryType: 'WEEKLY' | 'MONTHLY';
  contractSelectionTime: string; // '09:25'
  targetPremium: number; // 180
  breakoutStartTime: string; // '09:30'
  stopLoss: number; // 160
  target: number; // 220
  forceExitTime: string; // '09:45'
  maxTradesPerDay: number; // 1
  timeframe: string; // '1m'
  strikeSelection: 'CLOSEST_PREMIUM';
  referencePriceMode: ReferencePriceMode;
  stopLossMode: StopLossMode;
  targetMode: TargetMode;
  sameTimestampResolution: SameTimestampResolution;
  entryExecutionMode: EntryExecutionMode;
  intrabarConflictMode: IntrabarConflictMode;
  slippageMode: SlippageMode;
  slippageValue: number; // 0 by default
  brokeragePerOrder: number; // default ₹20
  sttRate: number; // default 0.0625% on sell turnover (0.000625)
  exchangeTurnoverRate: number; // 0.0505% (0.000505)
  sebiTurnoverRate: number; // ₹10 per crore (0.000001)
  stampDutyRate: number; // 0.003% on buy value (0.00003)
  gstRate: number; // 18% on (brokerage + exchange charges + sebi)
  quantityLots: number; // Default 1 lot
}

export interface Candle1Min {
  trading_date: string; // YYYY-MM-DD
  timestamp: string; // HH:mm:ss or HH:mm
  underlying: string;
  expiry_date: string;
  strike: number;
  option_type: 'CE' | 'PE';
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  open_interest: number;
}

export interface SelectedOptionContract {
  symbol: string;
  strike: number;
  expiry: string;
  optionType: 'CE' | 'PE';
  referencePremium925: number;
  distanceToTarget: number;
}

export interface AuditLogEntry {
  timestamp: string;
  event: string;
  details: string;
  cePremium?: number;
  pePremium?: number;
  action?: string;
}

export interface TimelinePoint {
  timestamp: string;
  ceClose: number;
  peClose: number;
  action?: string;
  isTrigger?: boolean;
}

export interface TradeRecord {
  trade_id: string;
  trading_date: string;
  underlying: string;
  expiry: string;
  selected_ce_symbol: string;
  selected_ce_strike: number;
  selected_ce_925_premium: number;
  selected_pe_symbol: string;
  selected_pe_strike: number;
  selected_pe_925_premium: number;
  trigger_option: 'CE' | 'PE';
  trigger_option_type: 'CE' | 'PE';
  trigger_timestamp: string;
  entry_price: number;
  entry_timestamp: string;
  stop_loss_price: number;
  target_price: number;
  exit_price: number;
  exit_timestamp: string;
  exit_reason: ExitReason;
  gross_points: number;
  gross_pnl: number;
  brokerage: number;
  exchange_charges: number;
  taxes: number;
  slippage: number;
  net_pnl: number;
  return_percentage: number;
  holding_duration: string;
  lot_size: number;
  quantity: number;
  audit_trail?: AuditLogEntry[];
  timeline?: TimelinePoint[];
}

export interface NoTradeRecord {
  trading_date: string;
  reason: NoTradeReason;
  details: string;
  audit_trail?: AuditLogEntry[];
}

export interface BacktestSummaryMetrics {
  totalTradingDays: number;
  tradingDays: number;
  noTradeDays: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  lossRatePct: number;
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  profitFactor: number;
  averageTradePnl: number;
  averageWinningTrade: number;
  averageLosingTrade: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  targetHitPct: number;
  slHitPct: number;
  timeExitPct: number;
  ceTradeCount: number;
  peTradeCount: number;
  ceWinRate: number;
  peWinRate: number;
  averageEntryPremium: number;
  averageExitPremium: number;
  averageHoldingTimeMinutes: number;
}

export interface DailyEquityPoint {
  date: string;
  dailyPnl: number;
  cumulativePnl: number;
  drawdown: number;
  drawdownPct: number;
  tradesCount: number;
  trade?: TradeRecord;
  noTradeReason?: NoTradeReason;
}

export interface BacktestMetadata {
  strategyVersion: string;
  strategyConfiguration: StrategyConfiguration;
  dataVersion: string;
  dataSource: string;
  startDate: string;
  endDate: string;
  timeframe: string;
  executionModel: EntryExecutionMode;
  slippageModel: SlippageMode;
  transactionCostModel: string;
  lotSizeModel: string;
  expirySelectionModel: string;
  timezone: string;
  generatedAt: string;
}

export interface BacktestResult {
  runId: string;
  strategyId: string;
  version: string;
  config: StrategyConfiguration;
  metrics: BacktestSummaryMetrics;
  trades: TradeRecord[];
  noTradeDays: NoTradeRecord[];
  equityCurve: DailyEquityPoint[];
  metadata: BacktestMetadata;
}
