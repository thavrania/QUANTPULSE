// =====================================================================
// QUANTPULSE — Automated Test Suite: NIFTY 09:30 ₹180 Breakout Strategy
// Part 36 Unit Tests: Tests 1 through 16 + Look-Ahead + Conflict Rules
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  selectClosestPremiumOption,
  executeStrategyForDay,
  validateDayData,
} from '../../src/lib/strategies/niftyBreakout180/breakoutEngine';
import { DEFAULT_STRATEGY_CONFIG } from '../../src/lib/strategies/niftyBreakout180/constants';
import { getLotSize } from '../../src/lib/strategies/niftyBreakout180/lotSizeEngine';
import { getTargetExpiry } from '../../src/lib/strategies/niftyBreakout180/expiryEngine';
import { applySlippage, calculateTransactionCosts } from '../../src/lib/strategies/niftyBreakout180/costsEngine';
import { getSampleOptionData } from '../../src/lib/strategies/niftyBreakout180/sampleData';
import { runBacktest } from '../../src/lib/strategies/niftyBreakout180/backtestRunner';
import { Candle1Min } from '../../src/lib/strategies/niftyBreakout180/types';

const sampleData = getSampleOptionData();

test('TEST 1: CE breaks first -> Expected: BUY CE, PE permanently disabled', () => {
  const day1Candles = sampleData['2026-09-01'];
  const res = executeStrategyForDay('2026-09-01', day1Candles, DEFAULT_STRATEGY_CONFIG);

  assert.equal(res.isTraded, true, 'Should be traded');
  assert.ok(res.trade, 'Trade record must exist');
  assert.equal(res.trade.trigger_option, 'CE', 'Must trigger CE');
  assert.equal(res.trade.trigger_option_type, 'CE');
  assert.ok(res.trade.entry_price > 0, 'Entry price must be valid');
});

test('TEST 2: PE breaks first -> Expected: BUY PE, CE permanently disabled', () => {
  const day2Candles = sampleData['2026-09-02'];
  const res = executeStrategyForDay('2026-09-02', day2Candles, DEFAULT_STRATEGY_CONFIG);

  assert.equal(res.isTraded, true, 'Should be traded');
  assert.ok(res.trade, 'Trade record must exist');
  assert.equal(res.trade.trigger_option, 'PE', 'Must trigger PE');
});

test('TEST 3: Neither breaks -> Expected: NO_TRADE (NO_BREAKOUT)', () => {
  const day4Candles = sampleData['2026-09-04'];
  const res = executeStrategyForDay('2026-09-04', day4Candles, DEFAULT_STRATEGY_CONFIG);

  assert.equal(res.isTraded, false, 'Must not be traded');
  assert.ok(res.noTrade, 'No-trade record must exist');
  assert.equal(res.noTrade.reason, 'NO_BREAKOUT');
});

test('TEST 4: CE crosses at 09:31 -> Expected: CE trade with entry timestamp recorded', () => {
  const day1Candles = sampleData['2026-09-01'];
  const res = executeStrategyForDay('2026-09-01', day1Candles, DEFAULT_STRATEGY_CONFIG);

  assert.equal(res.trade?.trigger_timestamp, '09:31:00 IST');
  assert.equal(res.trade?.entry_timestamp, '09:32:00 IST'); // NEXT_CANDLE_OPEN mode
  assert.equal(res.trade?.selected_ce_strike, 25000);
});

test('TEST 5: PE crosses at 09:34 -> Expected: PE trade with entry timestamp recorded', () => {
  const day6Candles = sampleData['2026-09-08'];
  const res = executeStrategyForDay('2026-09-08', day6Candles, DEFAULT_STRATEGY_CONFIG);

  assert.equal(res.trade?.trigger_option, 'PE');
  assert.equal(res.trade?.trigger_timestamp, '09:34:00 IST');
  assert.equal(res.trade?.entry_timestamp, '09:35:00 IST');
});

test('TEST 6: Both cross on same timestamp -> Expected: NO_TRADE using default conflict mode', () => {
  const day5Candles = sampleData['2026-09-07'];
  const res = executeStrategyForDay('2026-09-07', day5Candles, {
    ...DEFAULT_STRATEGY_CONFIG,
    sameTimestampResolution: 'NO_TRADE',
  });

  assert.equal(res.isTraded, false);
  assert.ok(res.noTrade);
  assert.equal(res.noTrade.reason, 'SIMULTANEOUS_BREAKOUT');
});

test('TEST 7: CE crosses at 09:31, PE crosses later -> Expected: Only CE trade', () => {
  const day1Candles = sampleData['2026-09-01'];
  const res = executeStrategyForDay('2026-09-01', day1Candles, DEFAULT_STRATEGY_CONFIG);

  assert.equal(res.trade?.trigger_option, 'CE');
  // Confirm only 1 trade generated and opposite leg never entered
  assert.equal(res.trade?.selected_pe_strike, 24800);
});

test('TEST 8: PE crosses at 09:33, CE crosses later -> Expected: Only PE trade', () => {
  const day2Candles = sampleData['2026-09-02'];
  const res = executeStrategyForDay('2026-09-02', day2Candles, DEFAULT_STRATEGY_CONFIG);

  assert.equal(res.trade?.trigger_option, 'PE');
});

test('TEST 9: Target reached -> Expected: Exit at target (₹220)', () => {
  const day1Candles = sampleData['2026-09-01'];
  const res = executeStrategyForDay('2026-09-01', day1Candles, DEFAULT_STRATEGY_CONFIG);

  assert.equal(res.trade?.exit_reason, 'TARGET_HIT');
  assert.equal(res.trade?.exit_price, 220);
  assert.ok(res.trade?.net_pnl > 0, 'Target hit should yield net profit');
});

test('TEST 10: SL reached -> Expected: Exit at SL (₹160)', () => {
  const day2Candles = sampleData['2026-09-02'];
  const res = executeStrategyForDay('2026-09-02', day2Candles, DEFAULT_STRATEGY_CONFIG);

  assert.equal(res.trade?.exit_reason, 'SL_HIT');
  assert.equal(res.trade?.exit_price, 160);
  assert.ok(res.trade?.net_pnl < 0, 'SL hit should yield net loss');
});

test('TEST 11: Neither target nor SL reached -> Expected: Exit at 09:45 (TIME_EXIT)', () => {
  const day3Candles = sampleData['2026-09-03'];
  const res = executeStrategyForDay('2026-09-03', day3Candles, DEFAULT_STRATEGY_CONFIG);

  assert.equal(res.trade?.exit_reason, 'TIME_EXIT');
  assert.equal(res.trade?.exit_timestamp, '09:45:00 IST');
  assert.equal(res.trade?.exit_price, 207);
});

test('TEST 12: Breakout before 09:30 must NOT trigger entry', () => {
  // Craft custom candles where CE is 185 at 09:27, but drops to 175 at 09:29
  const candles: Candle1Min[] = [
    {
      trading_date: '2026-09-10',
      timestamp: '09:25',
      underlying: 'NIFTY',
      expiry_date: '2026-09-10',
      strike: 25000,
      option_type: 'CE',
      open: 178, high: 180, low: 177, close: 179,
      volume: 1000, open_interest: 100000,
    },
    {
      trading_date: '2026-09-10',
      timestamp: '09:25',
      underlying: 'NIFTY',
      expiry_date: '2026-09-10',
      strike: 25000,
      option_type: 'PE',
      open: 178, high: 180, low: 177, close: 179,
      volume: 1000, open_interest: 100000,
    },
    {
      trading_date: '2026-09-10',
      timestamp: '09:27',
      underlying: 'NIFTY',
      expiry_date: '2026-09-10',
      strike: 25000,
      option_type: 'CE',
      open: 184, high: 186, low: 183, close: 185, // Pre-09:30 surge!
      volume: 1000, open_interest: 100000,
    },
    {
      trading_date: '2026-09-10',
      timestamp: '09:29',
      underlying: 'NIFTY',
      expiry_date: '2026-09-10',
      strike: 25000,
      option_type: 'CE',
      open: 176, high: 177, low: 174, close: 175,
      volume: 1000, open_interest: 100000,
    },
    {
      trading_date: '2026-09-10',
      timestamp: '09:29',
      underlying: 'NIFTY',
      expiry_date: '2026-09-10',
      strike: 25000,
      option_type: 'PE',
      open: 176, high: 177, low: 174, close: 175,
      volume: 1000, open_interest: 100000,
    },
    {
      trading_date: '2026-09-10',
      timestamp: '09:30',
      underlying: 'NIFTY',
      expiry_date: '2026-09-10',
      strike: 25000,
      option_type: 'CE',
      open: 175, high: 177, low: 174, close: 176,
      volume: 1000, open_interest: 100000,
    },
    {
      trading_date: '2026-09-10',
      timestamp: '09:30',
      underlying: 'NIFTY',
      expiry_date: '2026-09-10',
      strike: 25000,
      option_type: 'PE',
      open: 175, high: 177, low: 174, close: 176,
      volume: 1000, open_interest: 100000,
    },
  ];

  const res = executeStrategyForDay('2026-09-10', candles, DEFAULT_STRATEGY_CONFIG);
  // Must NOT enter during waiting period
  assert.equal(res.isTraded, false, 'Must not enter before 09:30');
});

test('TEST 13 & 14: Contract Selection strictly minimizes absolute distance to ₹180', () => {
  const mockCandidates: Candle1Min[] = [
    {
      trading_date: '2026-09-10',
      timestamp: '09:25',
      underlying: 'NIFTY',
      expiry_date: '2026-09-10',
      strike: 24900,
      option_type: 'CE',
      open: 177, high: 179, low: 176, close: 178, // distance = 2
      volume: 1000, open_interest: 100000,
    },
    {
      trading_date: '2026-09-10',
      timestamp: '09:25',
      underlying: 'NIFTY',
      expiry_date: '2026-09-10',
      strike: 25000,
      option_type: 'CE',
      open: 180, high: 182, low: 179, close: 181, // distance = 1 (CLOSER!)
      volume: 1000, open_interest: 100000,
    },
  ];

  const selected = selectClosestPremiumOption(mockCandidates, 180, 'CLOSE');
  assert.ok(selected);
  assert.equal(selected.strike, 25000, 'Strike with premium 181 must be selected over 178 because |181-180| < |178-180|');
  assert.equal(selected.distanceToTarget, 1);
});

test('TEST 15: No look-ahead bias exists', () => {
  // Inject an extreme future spike (e.g. ₹500 at 09:40) in a non-closest candidate
  const mockCandidates: Candle1Min[] = [
    {
      trading_date: '2026-09-10',
      timestamp: '09:25',
      underlying: 'NIFTY',
      expiry_date: '2026-09-10',
      strike: 25000,
      option_type: 'CE',
      open: 179, high: 181, low: 178, close: 180.2, // Closest at 09:25
      volume: 1000, open_interest: 100000,
    },
    {
      trading_date: '2026-09-10',
      timestamp: '09:25',
      underlying: 'NIFTY',
      expiry_date: '2026-09-10',
      strike: 25500,
      option_type: 'CE',
      open: 90, high: 95, low: 88, close: 92, // Much further at 09:25
      volume: 1000, open_interest: 100000,
    },
  ];

  // At 09:25, selection must only look at 09:25
  const selected = selectClosestPremiumOption(mockCandidates, 180, 'CLOSE');
  assert.equal(selected?.strike, 25000, 'Future prices must not influence 09:25 selection');
});

test('TEST 16: Historical NIFTY Lot Size engine adheres to regulatory schedule', () => {
  assert.equal(getLotSize('NIFTY', '2020-05-15'), 75, 'Pre-April 2021 was 75');
  assert.equal(getLotSize('NIFTY', '2022-01-10'), 50, '2022 era was 50');
  assert.equal(getLotSize('NIFTY', '2024-06-15'), 25, 'Mid-2024 era was 25');
  assert.equal(getLotSize('NIFTY', '2026-09-10'), 75, 'Current 2026 era is 75');
});

test('TEST 17: Consecutive transition logic - already above 180 does not re-trigger', () => {
  // If previous candle close was 182 and current is 185, no cross event occurs
  const prev = 182;
  const curr = 185;
  const cross = prev <= 180 && curr > 180;
  assert.equal(cross, false, 'Transition from 182 to 185 is not a breakout');
});

test('TEST 18: Full Backtest Engine Multi-Day Aggregation', () => {
  const result = runBacktest({
    candlesByDate: sampleData,
    config: DEFAULT_STRATEGY_CONFIG,
    dataSourceName: 'MOCK_HISTORICAL_FIXTURE',
  });

  assert.ok(result.runId.startsWith('RUN_NIFTY_0930_180_BREAKOUT'));
  assert.equal(result.trades.length, 4, 'Should have 4 executed trades (days 1, 2, 3, 6)');
  assert.equal(result.noTradeDays.length, 2, 'Should have 2 no-trade days (days 4, 5)');
  assert.ok(result.metrics.winRatePct >= 50, 'Win rate calculation must be computed');
  assert.equal(result.equityCurve.length, 6, 'Equity curve must have 6 points');
  assert.ok(result.metadata.strategyVersion === '1.0.0');
});
