// =====================================================================
// QUANTPULSE — Multi-Day Backtest Runner & Metrics Aggregator
// Parts 31, 33, 38, 39: Performance Analytics & Reproducibility Packager
// =====================================================================

import {
  Candle1Min,
  StrategyConfiguration,
  TradeRecord,
  NoTradeRecord,
  BacktestSummaryMetrics,
  DailyEquityPoint,
  BacktestResult,
  BacktestMetadata,
} from './types';
import { executeStrategyForDay } from './breakoutEngine';
import { STRATEGY_ID, STRATEGY_VERSION } from './constants';

export interface BacktestInput {
  candlesByDate: Record<string, Candle1Min[]>;
  config: StrategyConfiguration;
  startDate?: string;
  endDate?: string;
  dataSourceName?: string;
}

/**
 * Calculates complete Part 31 summary metrics across executed trades.
 */
export function calculateSummaryMetrics(
  totalDays: number,
  trades: TradeRecord[],
  noTradeDays: NoTradeRecord[]
): { metrics: BacktestSummaryMetrics; equityCurve: DailyEquityPoint[] } {
  const totalTrades = trades.length;
  const winningTradesList = trades.filter((t) => t.net_pnl > 0);
  const losingTradesList = trades.filter((t) => t.net_pnl <= 0);

  const winningTrades = winningTradesList.length;
  const losingTrades = losingTradesList.length;
  const winRatePct = totalTrades > 0 ? +((winningTrades / totalTrades) * 100).toFixed(2) : 0;
  const lossRatePct = totalTrades > 0 ? +((losingTrades / totalTrades) * 100).toFixed(2) : 0;

  const grossProfit = +winningTradesList.reduce((sum, t) => sum + t.net_pnl, 0).toFixed(2);
  const grossLoss = +Math.abs(losingTradesList.reduce((sum, t) => sum + t.net_pnl, 0)).toFixed(2);
  const netProfit = +(grossProfit - grossLoss).toFixed(2);

  const profitFactor = grossLoss > 0
    ? +(grossProfit / grossLoss).toFixed(2)
    : grossProfit > 0
    ? 999.99
    : 0;

  const averageTradePnl = totalTrades > 0 ? +(netProfit / totalTrades).toFixed(2) : 0;
  const averageWinningTrade = winningTrades > 0 ? +(grossProfit / winningTrades).toFixed(2) : 0;
  const averageLosingTrade = losingTrades > 0 ? +(-grossLoss / losingTrades).toFixed(2) : 0;

  // Consecutive wins / losses & Drawdown calculations
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let curWins = 0;
  let curLosses = 0;

  for (const t of trades) {
    if (t.net_pnl > 0) {
      curWins++;
      curLosses = 0;
      if (curWins > maxConsecutiveWins) maxConsecutiveWins = curWins;
    } else {
      curLosses++;
      curWins = 0;
      if (curLosses > maxConsecutiveLosses) maxConsecutiveLosses = curLosses;
    }
  }

  // Target Hit % / SL Hit % / Time Exit %
  const targetHits = trades.filter((t) => t.exit_reason === 'TARGET_HIT').length;
  const slHits = trades.filter((t) => t.exit_reason === 'SL_HIT').length;
  const timeExits = trades.filter((t) => t.exit_reason === 'TIME_EXIT').length;

  const targetHitPct = totalTrades > 0 ? +((targetHits / totalTrades) * 100).toFixed(2) : 0;
  const slHitPct = totalTrades > 0 ? +((slHits / totalTrades) * 100).toFixed(2) : 0;
  const timeExitPct = totalTrades > 0 ? +((timeExits / totalTrades) * 100).toFixed(2) : 0;

  // CE vs PE stats
  const ceTrades = trades.filter((t) => t.trigger_option === 'CE');
  const peTrades = trades.filter((t) => t.trigger_option === 'PE');
  const ceWins = ceTrades.filter((t) => t.net_pnl > 0).length;
  const peWins = peTrades.filter((t) => t.net_pnl > 0).length;

  const ceTradeCount = ceTrades.length;
  const peTradeCount = peTrades.length;
  const ceWinRate = ceTradeCount > 0 ? +((ceWins / ceTradeCount) * 100).toFixed(2) : 0;
  const peWinRate = peTradeCount > 0 ? +((peWins / peTradeCount) * 100).toFixed(2) : 0;

  const averageEntryPremium = totalTrades > 0
    ? +(trades.reduce((sum, t) => sum + t.entry_price, 0) / totalTrades).toFixed(2)
    : 0;

  const averageExitPremium = totalTrades > 0
    ? +(trades.reduce((sum, t) => sum + t.exit_price, 0) / totalTrades).toFixed(2)
    : 0;

  // Average Holding Time in minutes
  let totalHoldingMins = 0;
  for (const t of trades) {
    const mins = parseInt(t.holding_duration.replace('m', ''), 10) || 0;
    totalHoldingMins += mins;
  }
  const averageHoldingTimeMinutes = totalTrades > 0 ? +(totalHoldingMins / totalTrades).toFixed(1) : 0;

  // Equity Curve & Drawdown Timeline
  const tradeMap = new Map<string, TradeRecord>();
  trades.forEach((t) => tradeMap.set(t.trading_date, t));

  const noTradeMap = new Map<string, NoTradeRecord>();
  noTradeDays.forEach((nt) => noTradeMap.set(nt.trading_date, nt));

  // Collect all unique sorted dates
  const allDates = Array.from(
    new Set([...trades.map((t) => t.trading_date), ...noTradeDays.map((nt) => nt.trading_date)])
  ).sort();

  let cumPnl = 0;
  let peakPnl = 0;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  const equityCurve: DailyEquityPoint[] = [];

  for (const date of allDates) {
    const trade = tradeMap.get(date);
    const noTrade = noTradeMap.get(date);
    const dayPnl = trade ? trade.net_pnl : 0;

    cumPnl += dayPnl;
    if (cumPnl > peakPnl) {
      peakPnl = cumPnl;
    }

    const dd = +(peakPnl - cumPnl).toFixed(2);
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }

    const ddPct = peakPnl > 0 ? +((dd / peakPnl) * 100).toFixed(2) : 0;
    if (ddPct > maxDrawdownPct) {
      maxDrawdownPct = ddPct;
    }

    equityCurve.push({
      date,
      dailyPnl: +dayPnl.toFixed(2),
      cumulativePnl: +cumPnl.toFixed(2),
      drawdown: dd,
      drawdownPct: ddPct,
      tradesCount: trade ? 1 : 0,
      trade,
      noTradeReason: noTrade?.reason,
    });
  }

  const metrics: BacktestSummaryMetrics = {
    totalTradingDays: totalDays,
    tradingDays: trades.length,
    noTradeDays: noTradeDays.length,
    totalTrades,
    winningTrades,
    losingTrades,
    winRatePct,
    lossRatePct,
    grossProfit,
    grossLoss,
    netProfit,
    profitFactor,
    averageTradePnl,
    averageWinningTrade,
    averageLosingTrade,
    maxDrawdown: +maxDrawdown.toFixed(2),
    maxDrawdownPct: +maxDrawdownPct.toFixed(2),
    maxConsecutiveWins,
    maxConsecutiveLosses,
    targetHitPct,
    slHitPct,
    timeExitPct,
    ceTradeCount,
    peTradeCount,
    ceWinRate,
    peWinRate,
    averageEntryPremium,
    averageExitPremium,
    averageHoldingTimeMinutes,
  };

  return { metrics, equityCurve };
}

/**
 * Runs the full multi-day backtest across historical candles.
 */
export function runBacktest(input: BacktestInput): BacktestResult {
  const { candlesByDate, config, startDate, endDate, dataSourceName } = input;

  const sortedDates = Object.keys(candlesByDate).sort();
  const filteredDates = sortedDates.filter((d) => {
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  });

  const executedTrades: TradeRecord[] = [];
  const noTradeDays: NoTradeRecord[] = [];

  for (const date of filteredDates) {
    const dayCandles = candlesByDate[date];
    const dayResult = executeStrategyForDay(date, dayCandles, config);

    if (dayResult.isTraded && dayResult.trade) {
      executedTrades.push(dayResult.trade);
    } else if (dayResult.noTrade) {
      noTradeDays.push(dayResult.noTrade);
    }
  }

  const { metrics, equityCurve } = calculateSummaryMetrics(
    filteredDates.length,
    executedTrades,
    noTradeDays
  );

  const timestampId = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const runId = `RUN_${STRATEGY_ID}_${timestampId}`;

  const metadata: BacktestMetadata = {
    strategyVersion: STRATEGY_VERSION,
    strategyConfiguration: config,
    dataVersion: '1.0.0',
    dataSource: dataSourceName || 'NSE_HISTORICAL_OPTION_CHAIN',
    startDate: filteredDates[0] || '',
    endDate: filteredDates[filteredDates.length - 1] || '',
    timeframe: config.timeframe,
    executionModel: config.entryExecutionMode,
    slippageModel: config.slippageMode,
    transactionCostModel: 'INDIAN_NSE_OPTIONS_STT_GST_EXCHANGE',
    lotSizeModel: 'HISTORICAL_NSE_REGULATORY_MAP',
    expirySelectionModel: 'DYNAMIC_WEEKLY_CALENDAR',
    timezone: 'Asia/Kolkata (IST = UTC+05:30)',
    generatedAt: new Date().toISOString(),
  };

  return {
    runId,
    strategyId: STRATEGY_ID,
    version: STRATEGY_VERSION,
    config,
    metrics,
    trades: executedTrades,
    noTradeDays,
    equityCurve,
    metadata,
  };
}
