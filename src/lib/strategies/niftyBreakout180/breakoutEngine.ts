// =====================================================================
// QUANTPULSE — NIFTY 09:30 ₹180 Breakout Core Execution Engine
// Parts 5-19, 26-29, 35, 40, 41
// Deterministic, Zero-Lookahead State Machine & Trade Processor
// =====================================================================

import {
  BreakoutStrategyState,
  Candle1Min,
  StrategyConfiguration,
  SelectedOptionContract,
  TradeRecord,
  NoTradeRecord,
  AuditLogEntry,
  TimelinePoint,
} from './types';
import { getLotSize } from './lotSizeEngine';
import { getTargetExpiry } from './expiryEngine';
import { applySlippage, calculatePnl } from './costsEngine';
import { isTradingDay } from '../../services/marketHoursService';

export interface DayExecutionResult {
  tradingDate: string;
  isTraded: boolean;
  trade?: TradeRecord;
  noTrade?: NoTradeRecord;
  auditTrail: AuditLogEntry[];
  timeline: TimelinePoint[];
}

/**
 * Extracts reference price from a 1-min candle according to configured mode.
 */
export function getCandleReferencePrice(
  candle: Candle1Min,
  mode: StrategyConfiguration['referencePriceMode'] = 'CLOSE'
): number {
  switch (mode) {
    case 'OPEN':
      return candle.open;
    case 'HIGH':
      return candle.high;
    case 'LOW':
      return candle.low;
    case 'MIDPRICE':
      return +((candle.high + candle.low) / 2).toFixed(2);
    case 'CLOSE':
    default:
      return candle.close;
  }
}

/**
 * Normalizes timestamp string to HH:mm.
 */
export function normalizeTime(ts: string): string {
  if (!ts) return '';
  const parts = ts.trim().split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return ts;
}

/**
 * Part 5: Selects the option contract whose premium is closest to targetPremium (₹180).
 * Selection criterion is strictly: min ABS(premium - targetPremium).
 * Applied independently to CE and PE.
 */
export function selectClosestPremiumOption(
  candidates: Candle1Min[],
  targetPremium: number,
  mode: StrategyConfiguration['referencePriceMode'] = 'CLOSE'
): SelectedOptionContract | null {
  if (!candidates || candidates.length === 0) return null;

  let bestCandle = candidates[0];
  let bestPrice = getCandleReferencePrice(bestCandle, mode);
  let minDistance = Math.abs(bestPrice - targetPremium);

  for (let i = 1; i < candidates.length; i++) {
    const candle = candidates[i];
    const price = getCandleReferencePrice(candle, mode);
    const dist = Math.abs(price - targetPremium);

    if (dist < minDistance) {
      minDistance = dist;
      bestCandle = candle;
      bestPrice = price;
    } else if (dist === minDistance) {
      // Deterministic tie-breaker: prefer higher open interest or strike closest to ATM (180 base)
      if ((candle.open_interest || 0) > (bestCandle.open_interest || 0)) {
        bestCandle = candle;
        bestPrice = price;
      }
    }
  }

  return {
    symbol: `${bestCandle.underlying} ${bestCandle.expiry_date} ${bestCandle.strike} ${bestCandle.option_type}`,
    strike: bestCandle.strike,
    expiry: bestCandle.expiry_date,
    optionType: bestCandle.option_type,
    referencePremium925: bestPrice,
    distanceToTarget: +minDistance.toFixed(2),
  };
}

/**
 * Computes Stop Loss price according to configuration.
 */
export function computeStopLossPrice(
  entryPrice: number,
  config: StrategyConfiguration
): number {
  if (config.stopLossMode === 'FIXED_PREMIUM') {
    return config.stopLoss; // Default ₹160
  }
  if (config.stopLossMode === 'POINTS_FROM_ENTRY') {
    return Math.max(0.05, +(entryPrice - config.stopLoss).toFixed(2));
  }
  if (config.stopLossMode === 'PERCENT_FROM_ENTRY') {
    return Math.max(0.05, +(entryPrice * (1 - config.stopLoss / 100)).toFixed(2));
  }
  return config.stopLoss;
}

/**
 * Computes Target profit price according to configuration.
 */
export function computeTargetPrice(
  entryPrice: number,
  config: StrategyConfiguration
): number {
  if (config.targetMode === 'FIXED_PREMIUM') {
    return config.target; // Default ₹220
  }
  if (config.targetMode === 'POINTS_FROM_ENTRY') {
    return +(entryPrice + config.target).toFixed(2);
  }
  if (config.targetMode === 'PERCENT_FROM_ENTRY') {
    return +(entryPrice * (1 + config.target / 100)).toFixed(2);
  }
  return config.target;
}

/**
 * Validates a single trading day's historical data for edge cases (Part 26).
 */
export function validateDayData(
  tradingDate: string,
  dayCandles: Candle1Min[]
): { isValid: boolean; errorReason?: NoTradeRecord['reason']; details?: string } {
  // 1. Calendar check
  const [year, month, day] = tradingDate.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  const dayCheck = isTradingDay(dateObj);
  if (!dayCheck.isTradingDay) {
    return {
      isValid: false,
      errorReason: 'HOLIDAY',
      details: dayCheck.reason || 'Weekend or NSE market holiday',
    };
  }

  if (!dayCandles || dayCandles.length === 0) {
    return {
      isValid: false,
      errorReason: 'MARKET_CLOSED',
      details: 'No candle data available for trading day',
    };
  }

  // 2. Check 09:25 candle exists for both CE and PE
  const candles925 = dayCandles.filter((c) => normalizeTime(c.timestamp) === '09:25');
  const ce925 = candles925.filter((c) => c.option_type === 'CE');
  const pe925 = candles925.filter((c) => c.option_type === 'PE');

  if (ce925.length === 0) {
    return {
      isValid: false,
      errorReason: 'NO_CE_CONTRACT',
      details: 'Missing 09:25 CE candle in dataset',
    };
  }
  if (pe925.length === 0) {
    return {
      isValid: false,
      errorReason: 'NO_PE_CONTRACT',
      details: 'Missing 09:25 PE candle in dataset',
    };
  }

  // 3. Validate OHLC sanity (no negative prices, high >= low)
  for (const c of dayCandles) {
    if (c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0) {
      return {
        isValid: false,
        errorReason: 'DATA_ERROR',
        details: `Non-positive premium encountered at ${c.timestamp} for ${c.strike} ${c.option_type}`,
      };
    }
    if (c.high < c.low) {
      return {
        isValid: false,
        errorReason: 'DATA_ERROR',
        details: `Corrupt OHLC candle (High < Low) at ${c.timestamp}`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Core Single-Day Execution Logic (Parts 1-20, 27, 28, 29).
 * Runs the deterministic 9-state machine across 1-minute chronological candles.
 */
export function executeStrategyForDay(
  tradingDate: string,
  dayCandles: Candle1Min[],
  config: StrategyConfiguration
): DayExecutionResult {
  const auditTrail: AuditLogEntry[] = [];
  const timeline: TimelinePoint[] = [];

  const logAudit = (timestamp: string, event: string, details: string, extra?: Partial<AuditLogEntry>) => {
    auditTrail.push({ timestamp, event, details, ...extra });
  };

  // STEP 1 & 2: Validate Market Day & Data
  const validation = validateDayData(tradingDate, dayCandles);
  if (!validation.isValid) {
    logAudit('09:15', 'VALIDATION_FAILED', validation.details || 'Day data validation failed');
    return {
      tradingDate,
      isTraded: false,
      noTrade: {
        trading_date: tradingDate,
        reason: validation.errorReason || 'DATA_ERROR',
        details: validation.details || 'Invalid day data',
        audit_trail: auditTrail,
      },
      auditTrail,
      timeline,
    };
  }

  // STEP 3: Resolve Expiry and 09:25 Contract Selection
  const allExpiries = Array.from(new Set(dayCandles.map((c) => c.expiry_date)));
  const targetExpiry = getTargetExpiry(tradingDate, config.underlying, {
    expiryType: config.expiryType,
    availableExpiries: allExpiries,
  });

  const candlesAt925 = dayCandles.filter(
    (c) => normalizeTime(c.timestamp) === config.contractSelectionTime && c.expiry_date === targetExpiry
  );

  const ceCandidates = candlesAt925.filter((c) => c.option_type === 'CE');
  const peCandidates = candlesAt925.filter((c) => c.option_type === 'PE');

  const selectedCe = selectClosestPremiumOption(ceCandidates, config.targetPremium, config.referencePriceMode);
  const selectedPe = selectClosestPremiumOption(peCandidates, config.targetPremium, config.referencePriceMode);

  if (!selectedCe) {
    logAudit('09:25', 'SELECTION_ERROR', 'No eligible CE contract found for target expiry');
    return {
      tradingDate,
      isTraded: false,
      noTrade: {
        trading_date: tradingDate,
        reason: 'NO_CE_CONTRACT',
        details: 'No CE contract found at 09:25',
        audit_trail: auditTrail,
      },
      auditTrail,
      timeline,
    };
  }

  if (!selectedPe) {
    logAudit('09:25', 'SELECTION_ERROR', 'No eligible PE contract found for target expiry');
    return {
      tradingDate,
      isTraded: false,
      noTrade: {
        trading_date: tradingDate,
        reason: 'NO_PE_CONTRACT',
        details: 'No PE contract found at 09:25',
        audit_trail: auditTrail,
      },
      auditTrail,
      timeline,
    };
  }

  // STEP 4: Freeze Contracts
  logAudit(
    '09:25:00',
    'CONTRACTS_FROZEN',
    `CE: ${selectedCe.symbol} (₹${selectedCe.referencePremium925}) | PE: ${selectedPe.symbol} (₹${selectedPe.referencePremium925})`,
    { cePremium: selectedCe.referencePremium925, pePremium: selectedPe.referencePremium925 }
  );

  timeline.push({
    timestamp: '09:25',
    ceClose: selectedCe.referencePremium925,
    peClose: selectedPe.referencePremium925,
    action: '09:25 SELECTION',
  });

  // STEP 5: Filter chronological candles for the two selected contracts (Part 40 Optimization)
  const ceCandlesMap = new Map<string, Candle1Min>();
  const peCandlesMap = new Map<string, Candle1Min>();

  for (const c of dayCandles) {
    if (c.expiry_date === selectedCe.expiry && c.strike === selectedCe.strike && c.option_type === 'CE') {
      ceCandlesMap.set(normalizeTime(c.timestamp), c);
    }
    if (c.expiry_date === selectedPe.expiry && c.strike === selectedPe.strike && c.option_type === 'PE') {
      peCandlesMap.set(normalizeTime(c.timestamp), c);
    }
  }

  // STEP 6 & 7 & 8: Chronological Evaluation from 09:30 to 09:45
  let currentState: BreakoutStrategyState = 'WAITING_FOR_930';

  // Get baseline 09:29 candle closes as pre-condition
  const c929Ce = ceCandlesMap.get('09:29');
  const c929Pe = peCandlesMap.get('09:29');

  let previousCeClose = c929Ce ? c929Ce.close : selectedCe.referencePremium925;
  let previousPeClose = c929Pe ? c929Pe.close : selectedPe.referencePremium925;

  let triggerOption: 'CE' | 'PE' | null = null;
  let triggerTimestamp = '';
  let triggerBreakoutCandle: Candle1Min | null = null;
  let simultaneousConflictOccurred = false;

  const evaluationTimestamps = [
    '09:30', '09:31', '09:32', '09:33', '09:34',
    '09:35', '09:36', '09:37', '09:38', '09:39',
    '09:40', '09:41', '09:42', '09:43', '09:44', '09:45',
  ];

  currentState = 'MONITORING_BREAKOUT';

  for (let idx = 0; idx < evaluationTimestamps.length; idx++) {
    const time = evaluationTimestamps[idx];
    const ceCandle = ceCandlesMap.get(time);
    const peCandle = peCandlesMap.get(time);

    const curCe = ceCandle ? ceCandle.close : previousCeClose;
    const curPe = peCandle ? peCandle.close : previousPeClose;

    // Record timeline
    timeline.push({
      timestamp: time,
      ceClose: curCe,
      peClose: curPe,
    });

    // Detect Cross Above (Part 9, 10): previous <= 180 AND current > 180
    const ceCross = previousCeClose <= config.targetPremium && curCe > config.targetPremium;
    const peCross = previousPeClose <= config.targetPremium && curPe > config.targetPremium;

    logAudit(
      `${time}:00`,
      'MONITOR_TICK',
      `CE: ₹${curCe} (Cross: ${ceCross}) | PE: ₹${curPe} (Cross: ${peCross})`,
      { cePremium: curCe, pePremium: curPe }
    );

    // Part 13: Handle simultaneous breakout in the exact same candle
    if (ceCross && peCross) {
      logAudit(`${time}:00`, 'SIMULTANEOUS_BREAKOUT', 'Both CE and PE crossed ₹180 in same candle!');
      if (config.sameTimestampResolution === 'NO_TRADE') {
        simultaneousConflictOccurred = true;
        break;
      } else if (config.sameTimestampResolution === 'CE_FIRST') {
        triggerOption = 'CE';
        triggerTimestamp = time;
        triggerBreakoutCandle = ceCandle || null;
        break;
      } else if (config.sameTimestampResolution === 'PE_FIRST') {
        triggerOption = 'PE';
        triggerTimestamp = time;
        triggerBreakoutCandle = peCandle || null;
        break;
      } else if (config.sameTimestampResolution === 'HIGHER_MOMENTUM') {
        const ceMom = curCe - previousCeClose;
        const peMom = curPe - previousPeClose;
        triggerOption = ceMom >= peMom ? 'CE' : 'PE';
        triggerTimestamp = time;
        triggerBreakoutCandle = triggerOption === 'CE' ? ceCandle || null : peCandle || null;
        break;
      }
    } else if (ceCross) {
      triggerOption = 'CE';
      triggerTimestamp = time;
      triggerBreakoutCandle = ceCandle || null;
      currentState = 'CE_TRIGGERED';
      logAudit(`${time}:00`, 'CE_TRIGGERED', `CE crossed ₹180 first at ₹${curCe}! BUY CE initiated.`);
      break;
    } else if (peCross) {
      triggerOption = 'PE';
      triggerTimestamp = time;
      triggerBreakoutCandle = peCandle || null;
      currentState = 'PE_TRIGGERED';
      logAudit(`${time}:00`, 'PE_TRIGGERED', `PE crossed ₹180 first at ₹${curPe}! BUY PE initiated.`);
      break;
    }

    // Step forward previous closes
    previousCeClose = curCe;
    previousPeClose = curPe;
  }

  // Handle No Breakout or Simultaneous Breakout
  if (simultaneousConflictOccurred) {
    return {
      tradingDate,
      isTraded: false,
      noTrade: {
        trading_date: tradingDate,
        reason: 'SIMULTANEOUS_BREAKOUT',
        details: 'Both CE and PE crossed ₹180 at the same minute. Strategy resolution set to NO_TRADE.',
        audit_trail: auditTrail,
      },
      auditTrail,
      timeline,
    };
  }

  if (!triggerOption || !triggerTimestamp || !triggerBreakoutCandle) {
    logAudit('09:45:00', 'NO_BREAKOUT', 'Neither CE nor PE crossed above ₹180 before 09:45.');
    return {
      tradingDate,
      isTraded: false,
      noTrade: {
        trading_date: tradingDate,
        reason: 'NO_BREAKOUT',
        details: 'No contract broke above ₹180 by 09:45 IST.',
        audit_trail: auditTrail,
      },
      auditTrail,
      timeline,
    };
  }

  // STEP 9: Enter Trade (Only winning direction)
  const triggerSymbol = triggerOption === 'CE' ? selectedCe.symbol : selectedPe.symbol;
  const triggerStrike = triggerOption === 'CE' ? selectedCe.strike : selectedPe.strike;
  const triggerCandlesMap = triggerOption === 'CE' ? ceCandlesMap : peCandlesMap;

  // Determine Entry Price according to entryExecutionMode (Part 14)
  let rawEntryPrice = triggerBreakoutCandle.close;
  let entryTimestamp = triggerTimestamp;

  const triggerIndex = evaluationTimestamps.indexOf(triggerTimestamp);

  if (config.entryExecutionMode === 'NEXT_CANDLE_OPEN') {
    if (triggerIndex < evaluationTimestamps.length - 1) {
      const nextTime = evaluationTimestamps[triggerIndex + 1];
      const nextCandle = triggerCandlesMap.get(nextTime);
      if (nextCandle) {
        rawEntryPrice = nextCandle.open;
        entryTimestamp = nextTime;
      }
    }
  } else if (config.entryExecutionMode === 'CROSS_LEVEL') {
    rawEntryPrice = Math.max(config.targetPremium, triggerBreakoutCandle.open);
  } else if (config.entryExecutionMode === 'CURRENT_CANDLE_CLOSE') {
    rawEntryPrice = triggerBreakoutCandle.close;
  }

  // Apply Slippage to Entry Fill (Part 22)
  const entryFill = applySlippage(rawEntryPrice, 'BUY', config);
  const stopLossPrice = computeStopLossPrice(entryFill.effectivePrice, config);
  const targetPrice = computeTargetPrice(entryFill.effectivePrice, config);

  currentState = 'POSITION_OPEN';
  logAudit(
    `${entryTimestamp}:00`,
    'POSITION_OPENED',
    `BOUGHT ${triggerOption} (${triggerSymbol}) at ₹${entryFill.effectivePrice} (Raw: ₹${entryFill.rawPrice}, Slip: ₹${entryFill.slippageApplied}). SL: ₹${stopLossPrice}, Target: ₹${targetPrice}`
  );

  // STEP 10, 11, 12: Monitor Position through Subsequent Candles
  const lotSize = getLotSize(config.underlying, tradingDate);
  const totalQuantity = lotSize * config.quantityLots;

  let rawExitPrice = entryFill.effectivePrice;
  let exitTimestamp = config.forceExitTime;
  let exitReason: TradeRecord['exit_reason'] = 'TIME_EXIT';

  const positionStartIndex = evaluationTimestamps.indexOf(entryTimestamp);

  for (let pIdx = positionStartIndex; pIdx < evaluationTimestamps.length; pIdx++) {
    const time = evaluationTimestamps[pIdx];
    const c = triggerCandlesMap.get(time);
    if (!c) continue;

    // Check SL and Target Touched (Part 17: Intrabar conflict)
    const slTouched = c.low <= stopLossPrice;
    const targetTouched = c.high >= targetPrice;

    if (slTouched && targetTouched) {
      logAudit(
        `${time}:00`,
        'INTRABAR_CONFLICT',
        `Both SL (₹${stopLossPrice}) and Target (₹${targetPrice}) touched in candle High: ₹${c.high}, Low: ₹${c.low}. Conflict resolution: ${config.intrabarConflictMode}`
      );
      if (config.intrabarConflictMode === 'STOP_FIRST') {
        rawExitPrice = stopLossPrice;
        exitTimestamp = time;
        exitReason = 'SL_HIT';
        break;
      } else if (config.intrabarConflictMode === 'TARGET_FIRST') {
        rawExitPrice = targetPrice;
        exitTimestamp = time;
        exitReason = 'TARGET_HIT';
        break;
      } else {
        rawExitPrice = stopLossPrice;
        exitTimestamp = time;
        exitReason = 'AMBIGUOUS_EXIT';
        break;
      }
    } else if (targetTouched) {
      rawExitPrice = targetPrice;
      exitTimestamp = time;
      exitReason = 'TARGET_HIT';
      logAudit(`${time}:00`, 'TARGET_HIT', `Target reached! Exited at ₹${targetPrice}`);
      break;
    } else if (slTouched) {
      rawExitPrice = stopLossPrice;
      exitTimestamp = time;
      exitReason = 'SL_HIT';
      logAudit(`${time}:00`, 'SL_HIT', `Stop Loss breached! Exited at ₹${stopLossPrice}`);
      break;
    }

    // Force Exit at 09:45 (Part 18)
    if (time === config.forceExitTime) {
      rawExitPrice = c.close;
      exitTimestamp = time;
      exitReason = 'TIME_EXIT';
      logAudit(`${time}:00`, 'TIME_EXIT', `09:45 forced exit executed at Close: ₹${rawExitPrice}`);
      break;
    }
  }

  // Apply Slippage to Exit Fill
  const exitFill = applySlippage(rawExitPrice, 'SELL', config);
  currentState = 'POSITION_EXITED';

  // Calculate P&L & Indian Costs (Parts 20, 22, 23, 24)
  const pnl = calculatePnl(entryFill, exitFill, totalQuantity, config);

  // Calculate holding duration in minutes
  const [eH, eM] = entryTimestamp.split(':').map(Number);
  const [xH, xM] = exitTimestamp.split(':').map(Number);
  const durationMins = Math.max(1, (xH * 60 + xM) - (eH * 60 + eM));
  const holdingDuration = `${durationMins}m`;

  const tradeRecord: TradeRecord = {
    trade_id: `TRADE_${tradingDate.replace(/-/g, '')}_${triggerOption}`,
    trading_date: tradingDate,
    underlying: config.underlying,
    expiry: targetExpiry,
    selected_ce_symbol: selectedCe.symbol,
    selected_ce_strike: selectedCe.strike,
    selected_ce_925_premium: selectedCe.referencePremium925,
    selected_pe_symbol: selectedPe.symbol,
    selected_pe_strike: selectedPe.strike,
    selected_pe_925_premium: selectedPe.referencePremium925,
    trigger_option: triggerOption,
    trigger_option_type: triggerOption,
    trigger_timestamp: `${triggerTimestamp}:00 IST`,
    entry_price: entryFill.effectivePrice,
    entry_timestamp: `${entryTimestamp}:00 IST`,
    stop_loss_price: stopLossPrice,
    target_price: targetPrice,
    exit_price: exitFill.effectivePrice,
    exit_timestamp: `${exitTimestamp}:00 IST`,
    exit_reason: exitReason,
    gross_points: pnl.grossPoints,
    gross_pnl: pnl.grossPnl,
    brokerage: pnl.costs.brokerage,
    exchange_charges: pnl.costs.exchangeCharges,
    taxes: +(pnl.costs.stt + pnl.costs.gst + pnl.costs.sebiCharges + pnl.costs.stampDuty).toFixed(2),
    slippage: pnl.slippageCostTotal,
    net_pnl: pnl.netPnl,
    return_percentage: pnl.returnPercentage,
    holding_duration: holdingDuration,
    lot_size: lotSize,
    quantity: totalQuantity,
    audit_trail: auditTrail,
    timeline,
  };

  currentState = 'DAY_COMPLETED';
  logAudit(
    `${exitTimestamp}:00`,
    'DAY_LOCKED',
    `Trade completed with Net P&L: ₹${pnl.netPnl} (${pnl.returnPercentage}%). Day locked.`
  );

  return {
    tradingDate,
    isTraded: true,
    trade: tradeRecord,
    auditTrail,
    timeline,
  };
}
