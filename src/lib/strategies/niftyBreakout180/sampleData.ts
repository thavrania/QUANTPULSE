// =====================================================================
// QUANTPULSE — Historical NIFTY Option-Chain 1-Minute Candle Datasets
// Provides realistic 1-min OHLCV option chain candles for backtesting & testing
// =====================================================================

import { Candle1Min } from './types';
import { getTargetExpiry } from './expiryEngine';

interface MinutePricePoint {
  time: string;
  ceOpen: number;
  ceHigh: number;
  ceLow: number;
  ceClose: number;
  peOpen: number;
  peHigh: number;
  peLow: number;
  peClose: number;
}

/**
 * Builds a 1-minute candle object.
 */
function makeCandle(
  date: string,
  time: string,
  strike: number,
  type: 'CE' | 'PE',
  expiry: string,
  open: number,
  high: number,
  low: number,
  close: number,
  oi: number = 250000
): Candle1Min {
  return {
    trading_date: date,
    timestamp: time,
    underlying: 'NIFTY',
    expiry_date: expiry,
    strike,
    option_type: type,
    open: +open.toFixed(2),
    high: +high.toFixed(2),
    low: +low.toFixed(2),
    close: +close.toFixed(2),
    volume: Math.floor(1000 + Math.random() * 5000),
    open_interest: oi,
  };
}

/**
 * Generates full day 1-minute candles for CE & PE given trajectory points.
 */
function generateDayFromPoints(
  date: string,
  ceStrike: number,
  peStrike: number,
  points: MinutePricePoint[]
): Candle1Min[] {
  const expiry = getTargetExpiry(date);
  const candles: Candle1Min[] = [];

  // Also include background non-closest strikes to test selection fidelity
  const backgroundStrikes = [ceStrike - 100, ceStrike + 100, peStrike - 100, peStrike + 100];

  for (const pt of points) {
    // Primary selected candidate strikes
    candles.push(
      makeCandle(date, pt.time, ceStrike, 'CE', expiry, pt.ceOpen, pt.ceHigh, pt.ceLow, pt.ceClose, 450000)
    );
    candles.push(
      makeCandle(date, pt.time, peStrike, 'PE', expiry, pt.peOpen, pt.peHigh, pt.peLow, pt.peClose, 410000)
    );

    // Add background strikes with prices further from 180 (e.g. 110, 260)
    candles.push(
      makeCandle(date, pt.time, backgroundStrikes[0], 'CE', expiry, 265, 268, 262, 264, 180000)
    );
    candles.push(
      makeCandle(date, pt.time, backgroundStrikes[1], 'CE', expiry, 115, 118, 112, 114, 190000)
    );
    candles.push(
      makeCandle(date, pt.time, backgroundStrikes[2], 'PE', expiry, 120, 122, 117, 119, 170000)
    );
    candles.push(
      makeCandle(date, pt.time, backgroundStrikes[3], 'PE', expiry, 255, 258, 250, 252, 160000)
    );
  }

  return candles;
}

/**
 * Day 1: 2026-09-01 (Tuesday) - CE Breakout at 09:31 -> Target Hit at ₹220
 */
function getDay1Candles(): Candle1Min[] {
  const date = '2026-09-01';
  const ceStrike = 25000;
  const peStrike = 24800;

  const points: MinutePricePoint[] = [
    { time: '09:25', ceOpen: 177, ceHigh: 179, ceLow: 176, ceClose: 178, peOpen: 183, peHigh: 184, peLow: 181, peClose: 182 }, // Closest: CE 178 (dist 2), PE 182 (dist 2)
    { time: '09:26', ceOpen: 178, ceHigh: 179, ceLow: 177, ceClose: 178.5, peOpen: 182, peHigh: 182.5, peLow: 180, peClose: 180.5 },
    { time: '09:27', ceOpen: 178.5, ceHigh: 179, ceLow: 177, ceClose: 177.5, peOpen: 180.5, peHigh: 181, peLow: 179, peClose: 179.5 },
    { time: '09:28', ceOpen: 177.5, ceHigh: 178.5, ceLow: 176, ceClose: 177, peOpen: 179.5, peHigh: 180, peLow: 178, peClose: 178 },
    { time: '09:29', ceOpen: 177, ceHigh: 178, ceLow: 176.5, ceClose: 177.5, peOpen: 178, peHigh: 179, peLow: 177, peClose: 178.5 }, // Pre-condition closes <= 180
    { time: '09:30', ceOpen: 177.5, ceHigh: 179.5, ceLow: 177, ceClose: 179, peOpen: 178.5, peHigh: 179.5, peLow: 177, peClose: 178 },
    { time: '09:31', ceOpen: 179, ceHigh: 183.5, ceLow: 178.5, ceClose: 182.5, peOpen: 178, peHigh: 179, peLow: 176, peClose: 177 }, // CE CROSSES ABOVE 180!
    { time: '09:32', ceOpen: 182.5, ceHigh: 188, ceLow: 181.5, ceClose: 186, peOpen: 177, peHigh: 177.5, peLow: 174, peClose: 174.5 }, // Entry at Next Open: 182.50
    { time: '09:33', ceOpen: 186, ceHigh: 194, ceLow: 185, ceClose: 192, peOpen: 174.5, peHigh: 175, peLow: 171, peClose: 172 },
    { time: '09:34', ceOpen: 192, ceHigh: 199, ceLow: 191, ceClose: 197.5, peOpen: 172, peHigh: 172.5, peLow: 168, peClose: 169 },
    { time: '09:35', ceOpen: 197.5, ceHigh: 206, ceLow: 196, ceClose: 204, peOpen: 169, peHigh: 170, peLow: 165, peClose: 166 },
    { time: '09:36', ceOpen: 204, ceHigh: 213, ceLow: 202, ceClose: 210, peOpen: 166, peHigh: 167, peLow: 162, peClose: 163 },
    { time: '09:37', ceOpen: 210, ceHigh: 222.5, ceLow: 208, ceClose: 221, peOpen: 163, peHigh: 164, peLow: 159, peClose: 160 }, // TARGET REACHED (>= 220)!
    { time: '09:38', ceOpen: 221, ceHigh: 225, ceLow: 218, ceClose: 223, peOpen: 160, peHigh: 161, peLow: 158, peClose: 158.5 },
    { time: '09:39', ceOpen: 223, ceHigh: 226, ceLow: 220, ceClose: 224, peOpen: 158.5, peHigh: 159, peLow: 157, peClose: 157.5 },
    { time: '09:40', ceOpen: 224, ceHigh: 228, ceLow: 222, ceClose: 226, peOpen: 157.5, peHigh: 158, peLow: 155, peClose: 156 },
    { time: '09:41', ceOpen: 226, ceHigh: 229, ceLow: 224, ceClose: 227, peOpen: 156, peHigh: 157, peLow: 154, peClose: 155 },
    { time: '09:42', ceOpen: 227, ceHigh: 230, ceLow: 225, ceClose: 228, peOpen: 155, peHigh: 156, peLow: 153, peClose: 154 },
    { time: '09:43', ceOpen: 228, ceHigh: 231, ceLow: 226, ceClose: 229, peOpen: 154, peHigh: 155, peLow: 152, peClose: 153 },
    { time: '09:44', ceOpen: 229, ceHigh: 232, ceLow: 227, ceClose: 230, peOpen: 153, peHigh: 154, peLow: 151, peClose: 152 },
    { time: '09:45', ceOpen: 230, ceHigh: 233, ceLow: 228, ceClose: 231, peOpen: 152, peHigh: 153, peLow: 150, peClose: 151 },
  ];

  return generateDayFromPoints(date, ceStrike, peStrike, points);
}

/**
 * Day 2: 2026-09-02 (Wednesday) - PE Breakout at 09:33 -> SL Hit at ₹160
 */
function getDay2Candles(): Candle1Min[] {
  const date = '2026-09-02';
  const ceStrike = 25100;
  const peStrike = 24900;

  const points: MinutePricePoint[] = [
    { time: '09:25', ceOpen: 181, ceHigh: 182, ceLow: 179, ceClose: 180.5, peOpen: 178, peHigh: 179, peLow: 176, peClose: 177.5 },
    { time: '09:26', ceOpen: 180.5, ceHigh: 181, ceLow: 178, ceClose: 179, peOpen: 177.5, peHigh: 178.5, peLow: 176, peClose: 177 },
    { time: '09:27', ceOpen: 179, ceHigh: 179.5, ceLow: 177, ceClose: 178, peOpen: 177, peHigh: 178, peLow: 176.5, peClose: 177.5 },
    { time: '09:28', ceOpen: 178, ceHigh: 178.5, ceLow: 176, ceClose: 177, peOpen: 177.5, peHigh: 178.5, peLow: 176, peClose: 177 },
    { time: '09:29', ceOpen: 177, ceHigh: 178, ceLow: 175, ceClose: 176, peOpen: 177, peHigh: 178.5, peLow: 176, peClose: 178 }, // Both <= 180
    { time: '09:30', ceOpen: 176, ceHigh: 177, ceLow: 174, ceClose: 175, peOpen: 178, peHigh: 179.5, peLow: 177, peClose: 179 },
    { time: '09:31', ceOpen: 175, ceHigh: 176, ceLow: 173, ceClose: 174, peOpen: 179, peHigh: 179.8, peLow: 177.5, peClose: 179.5 },
    { time: '09:32', ceOpen: 174, ceHigh: 175, ceLow: 172, ceClose: 173, peOpen: 179.5, peHigh: 180.0, peLow: 178, peClose: 179.8 },
    { time: '09:33', ceOpen: 173, ceHigh: 174, ceLow: 171, ceClose: 172, peOpen: 179.8, peHigh: 184, peLow: 179, peClose: 183 }, // PE CROSSES ABOVE 180!
    { time: '09:34', ceOpen: 172, ceHigh: 175, ceLow: 171, ceClose: 174, peOpen: 183, peHigh: 184.5, peLow: 179, peClose: 180 }, // Entry at Next Open: 183
    { time: '09:35', ceOpen: 174, ceHigh: 179, ceLow: 173, ceClose: 178, peOpen: 180, peHigh: 181, peLow: 173, peClose: 174 },
    { time: '09:36', ceOpen: 178, ceHigh: 185, ceLow: 177, ceClose: 184, peOpen: 174, peHigh: 175, peLow: 167, peClose: 168 },
    { time: '09:37', ceOpen: 184, ceHigh: 191, ceLow: 183, ceClose: 190, peOpen: 168, peHigh: 169, peLow: 158, peClose: 159 }, // PE LOW TOUCHES <= 160 (SL HIT)!
    { time: '09:38', ceOpen: 190, ceHigh: 195, ceLow: 188, ceClose: 193, peOpen: 159, peHigh: 162, peLow: 155, peClose: 157 },
    { time: '09:39', ceOpen: 193, ceHigh: 196, ceLow: 190, ceClose: 194, peOpen: 157, peHigh: 159, peLow: 154, peClose: 156 },
    { time: '09:40', ceOpen: 194, ceHigh: 197, ceLow: 191, ceClose: 195, peOpen: 156, peHigh: 158, peLow: 153, peClose: 155 },
    { time: '09:41', ceOpen: 195, ceHigh: 198, ceLow: 192, ceClose: 196, peOpen: 155, peHigh: 157, peLow: 152, peClose: 154 },
    { time: '09:42', ceOpen: 196, ceHigh: 199, ceLow: 193, ceClose: 197, peOpen: 154, peHigh: 156, peLow: 151, peClose: 153 },
    { time: '09:43', ceOpen: 197, ceHigh: 200, ceLow: 194, ceClose: 198, peOpen: 153, peHigh: 155, peLow: 150, peClose: 152 },
    { time: '09:44', ceOpen: 198, ceHigh: 201, ceLow: 195, ceClose: 199, peOpen: 152, peHigh: 154, peLow: 149, peClose: 151 },
    { time: '09:45', ceOpen: 199, ceHigh: 202, ceLow: 196, ceClose: 200, peOpen: 151, peHigh: 153, peLow: 148, peClose: 150 },
  ];

  return generateDayFromPoints(date, ceStrike, peStrike, points);
}

/**
 * Day 3: 2026-09-03 (Thursday) - CE Breakout at 09:32 -> 09:45 Force Exit at ₹207
 */
function getDay3Candles(): Candle1Min[] {
  const date = '2026-09-03';
  const ceStrike = 25050;
  const peStrike = 24850;

  const points: MinutePricePoint[] = [
    { time: '09:25', ceOpen: 178, ceHigh: 180, ceLow: 177, ceClose: 179, peOpen: 181, peHigh: 182, peLow: 179, peClose: 180 },
    { time: '09:26', ceOpen: 179, ceHigh: 180, ceLow: 177, ceClose: 178, peOpen: 180, peHigh: 181, peLow: 178, peClose: 179 },
    { time: '09:27', ceOpen: 178, ceHigh: 179, ceLow: 176, ceClose: 177, peOpen: 179, peHigh: 180, peLow: 177, peClose: 178 },
    { time: '09:28', ceOpen: 177, ceHigh: 178, ceLow: 176, ceClose: 177.5, peOpen: 178, peHigh: 179, peLow: 176, peClose: 177 },
    { time: '09:29', ceOpen: 177.5, ceHigh: 178, ceLow: 176, ceClose: 177, peOpen: 177, peHigh: 178, peLow: 176, peClose: 177.5 },
    { time: '09:30', ceOpen: 177, ceHigh: 179, ceLow: 176, ceClose: 178, peOpen: 177.5, peHigh: 178.5, peLow: 176, peClose: 177 },
    { time: '09:31', ceOpen: 178, ceHigh: 179.8, ceLow: 177, ceClose: 179.5, peOpen: 177, peHigh: 178, peLow: 175, peClose: 176 },
    { time: '09:32', ceOpen: 179.5, ceHigh: 183.5, ceLow: 179, ceClose: 182, peOpen: 176, peHigh: 177, peLow: 174, peClose: 175 }, // CE Crosses!
    { time: '09:33', ceOpen: 182, ceHigh: 186, ceLow: 181, ceClose: 185, peOpen: 175, peHigh: 176, peLow: 173, peClose: 174 }, // Entry at Next Open: 182
    { time: '09:34', ceOpen: 185, ceHigh: 188, ceLow: 183, ceClose: 187, peOpen: 174, peHigh: 175, peLow: 172, peClose: 173 },
    { time: '09:35', ceOpen: 187, ceHigh: 191, ceLow: 185, ceClose: 189, peOpen: 173, peHigh: 174, peLow: 171, peClose: 172 },
    { time: '09:36', ceOpen: 189, ceHigh: 194, ceLow: 188, ceClose: 192, peOpen: 172, peHigh: 173, peLow: 170, peClose: 171 },
    { time: '09:37', ceOpen: 192, ceHigh: 196, ceLow: 190, ceClose: 194, peOpen: 171, peHigh: 172, peLow: 169, peClose: 170 },
    { time: '09:38', ceOpen: 194, ceHigh: 198, ceLow: 192, ceClose: 196, peOpen: 170, peHigh: 171, peLow: 168, peClose: 169 },
    { time: '09:39', ceOpen: 196, ceHigh: 201, ceLow: 194, ceClose: 199, peOpen: 169, peHigh: 170, peLow: 167, peClose: 168 },
    { time: '09:40', ceOpen: 199, ceHigh: 203, ceLow: 197, ceClose: 201, peOpen: 168, peHigh: 169, peLow: 166, peClose: 167 },
    { time: '09:41', ceOpen: 201, ceHigh: 205, ceLow: 199, ceClose: 203, peOpen: 167, peHigh: 168, peLow: 165, peClose: 166 },
    { time: '09:42', ceOpen: 203, ceHigh: 206, ceLow: 201, ceClose: 204, peOpen: 166, peHigh: 167, peLow: 164, peClose: 165 },
    { time: '09:43', ceOpen: 204, ceHigh: 207, ceLow: 202, ceClose: 205, peOpen: 165, peHigh: 166, peLow: 163, peClose: 164 },
    { time: '09:44', ceOpen: 205, ceHigh: 208, ceLow: 203, ceClose: 206, peOpen: 164, peHigh: 165, peLow: 162, peClose: 163 },
    { time: '09:45', ceOpen: 206, ceHigh: 208, ceLow: 205, ceClose: 207, peOpen: 163, peHigh: 164, peLow: 161, peClose: 162 }, // TIME EXIT AT 09:45 (Close: 207)
  ];

  return generateDayFromPoints(date, ceStrike, peStrike, points);
}

/**
 * Day 4: 2026-09-04 (Friday) - Neither breaks ₹180 -> NO_BREAKOUT
 */
function getDay4Candles(): Candle1Min[] {
  const date = '2026-09-04';
  const ceStrike = 25000;
  const peStrike = 24800;

  const points: MinutePricePoint[] = [
    { time: '09:25', ceOpen: 175, ceHigh: 178, ceLow: 174, ceClose: 177, peOpen: 176, peHigh: 178, peLow: 174, peClose: 176 },
    { time: '09:26', ceOpen: 177, ceHigh: 178, ceLow: 175, ceClose: 176, peOpen: 176, peHigh: 177, peLow: 175, peClose: 175.5 },
    { time: '09:27', ceOpen: 176, ceHigh: 177, ceLow: 174, ceClose: 175, peOpen: 175.5, peHigh: 176, peLow: 174, peClose: 175 },
    { time: '09:28', ceOpen: 175, ceHigh: 176, ceLow: 173, ceClose: 174, peOpen: 175, peHigh: 176, peLow: 173, peClose: 174 },
    { time: '09:29', ceOpen: 174, ceHigh: 175, ceLow: 173, ceClose: 174.5, peOpen: 174, peHigh: 175, peLow: 173, peClose: 174.5 },
    { time: '09:30', ceOpen: 174.5, ceHigh: 176, ceLow: 173, ceClose: 175, peOpen: 174.5, peHigh: 176, peLow: 173, peClose: 175 },
    { time: '09:31', ceOpen: 175, ceHigh: 176.5, ceLow: 174, ceClose: 175.5, peOpen: 175, peHigh: 176.5, peLow: 174, peClose: 175.5 },
    { time: '09:32', ceOpen: 175.5, ceHigh: 177, ceLow: 174, ceClose: 176, peOpen: 175.5, peHigh: 177, peLow: 174, peClose: 176 },
    { time: '09:33', ceOpen: 176, ceHigh: 177.5, ceLow: 175, ceClose: 176.5, peOpen: 176, peHigh: 177.5, peLow: 175, peClose: 176.5 },
    { time: '09:34', ceOpen: 176.5, ceHigh: 178, ceLow: 175, ceClose: 177, peOpen: 176.5, peHigh: 178, peLow: 175, peClose: 177 },
    { time: '09:35', ceOpen: 177, ceHigh: 178.5, ceLow: 176, ceClose: 177.5, peOpen: 177, peHigh: 178.5, peLow: 176, peClose: 177.5 },
    { time: '09:36', ceOpen: 177.5, ceHigh: 179, ceLow: 176, ceClose: 178, peOpen: 177.5, peHigh: 179, peLow: 176, peClose: 178 },
    { time: '09:37', ceOpen: 178, ceHigh: 179.5, ceLow: 177, ceClose: 178.5, peOpen: 178, peHigh: 179.5, peLow: 177, peClose: 178.5 },
    { time: '09:38', ceOpen: 178.5, ceHigh: 179.8, ceLow: 177, ceClose: 179, peOpen: 178.5, peHigh: 179.8, peLow: 177, peClose: 179 },
    { time: '09:39', ceOpen: 179, ceHigh: 179.5, ceLow: 177, ceClose: 178, peOpen: 179, peHigh: 179.5, peLow: 177, peClose: 178 },
    { time: '09:40', ceOpen: 178, ceHigh: 179, ceLow: 176, ceClose: 177, peOpen: 178, peHigh: 179, peLow: 176, peClose: 177 },
    { time: '09:41', ceOpen: 177, ceHigh: 178, ceLow: 175, ceClose: 176, peOpen: 177, peHigh: 178, peLow: 175, peClose: 176 },
    { time: '09:42', ceOpen: 176, ceHigh: 177, ceLow: 174, ceClose: 175, peOpen: 176, peHigh: 177, peLow: 174, peClose: 175 },
    { time: '09:43', ceOpen: 175, ceHigh: 176, ceLow: 173, ceClose: 174, peOpen: 175, peHigh: 176, peLow: 173, peClose: 174 },
    { time: '09:44', ceOpen: 174, ceHigh: 175, ceLow: 172, ceClose: 173, peOpen: 174, peHigh: 175, peLow: 172, peClose: 173 },
    { time: '09:45', ceOpen: 173, ceHigh: 174, ceLow: 171, ceClose: 172, peOpen: 173, peHigh: 174, peLow: 171, peClose: 172 }, // Neither broke 180!
  ];

  return generateDayFromPoints(date, ceStrike, peStrike, points);
}

/**
 * Day 5: 2026-09-07 (Monday) - Simultaneous Breakout at 09:31 -> SIMULTANEOUS_BREAKOUT
 */
function getDay5Candles(): Candle1Min[] {
  const date = '2026-09-07';
  const ceStrike = 25000;
  const peStrike = 24800;

  const points: MinutePricePoint[] = [
    { time: '09:25', ceOpen: 178, ceHigh: 180, ceLow: 177, ceClose: 179, peOpen: 178, peHigh: 180, peLow: 177, peClose: 179 },
    { time: '09:26', ceOpen: 179, ceHigh: 180, ceLow: 177, ceClose: 178, peOpen: 179, peHigh: 180, peLow: 177, peClose: 178 },
    { time: '09:27', ceOpen: 178, ceHigh: 179, ceLow: 176, ceClose: 177, peOpen: 178, peHigh: 179, peLow: 176, peClose: 177 },
    { time: '09:28', ceOpen: 177, ceHigh: 178, ceLow: 175, ceClose: 176, peOpen: 177, peHigh: 178, peLow: 175, peClose: 176 },
    { time: '09:29', ceOpen: 176, ceHigh: 177, ceLow: 175, ceClose: 176.5, peOpen: 176, peHigh: 177, peLow: 175, peClose: 176.5 },
    { time: '09:30', ceOpen: 176.5, ceHigh: 178.5, ceLow: 176, ceClose: 178, peOpen: 176.5, peHigh: 178.5, peLow: 176, peClose: 178 },
    // AT 09:31: BOTH CE AND PE CROSS ABOVE 180!
    { time: '09:31', ceOpen: 178, ceHigh: 183, ceLow: 177.5, ceClose: 182, peOpen: 178, peHigh: 183.5, peLow: 177.5, peClose: 182.5 },
    { time: '09:32', ceOpen: 182, ceHigh: 185, ceLow: 180, ceClose: 183, peOpen: 182.5, peHigh: 186, peLow: 181, peClose: 184 },
    { time: '09:33', ceOpen: 183, ceHigh: 186, ceLow: 181, ceClose: 184, peOpen: 184, peHigh: 187, peLow: 182, peClose: 185 },
    { time: '09:34', ceOpen: 184, ceHigh: 187, ceLow: 182, ceClose: 185, peOpen: 185, peHigh: 188, peLow: 183, peClose: 186 },
    { time: '09:35', ceOpen: 185, ceHigh: 188, ceLow: 183, ceClose: 186, peOpen: 186, peHigh: 189, peLow: 184, peClose: 187 },
    { time: '09:36', ceOpen: 186, ceHigh: 189, ceLow: 184, ceClose: 187, peOpen: 187, peHigh: 190, peLow: 185, peClose: 188 },
    { time: '09:37', ceOpen: 187, ceHigh: 190, ceLow: 185, ceClose: 188, peOpen: 188, peHigh: 191, peLow: 186, peClose: 189 },
    { time: '09:38', ceOpen: 188, ceHigh: 191, ceLow: 186, ceClose: 189, peOpen: 189, peHigh: 192, peLow: 187, peClose: 190 },
    { time: '09:39', ceOpen: 189, ceHigh: 192, ceLow: 187, ceClose: 190, peOpen: 190, peHigh: 193, peLow: 188, peClose: 191 },
    { time: '09:40', ceOpen: 190, ceHigh: 193, ceLow: 188, ceClose: 191, peOpen: 191, peHigh: 194, peLow: 189, peClose: 192 },
    { time: '09:41', ceOpen: 191, ceHigh: 194, ceLow: 189, ceClose: 192, peOpen: 192, peHigh: 195, peLow: 190, peClose: 193 },
    { time: '09:42', ceOpen: 192, ceHigh: 195, ceLow: 190, ceClose: 193, peOpen: 193, peHigh: 196, peLow: 191, peClose: 194 },
    { time: '09:43', ceOpen: 193, ceHigh: 196, ceLow: 191, ceClose: 194, peOpen: 194, peHigh: 197, peLow: 192, peClose: 195 },
    { time: '09:44', ceOpen: 194, ceHigh: 197, ceLow: 192, ceClose: 195, peOpen: 195, peHigh: 198, peLow: 193, peClose: 196 },
    { time: '09:45', ceOpen: 195, ceHigh: 198, ceLow: 193, ceClose: 196, peOpen: 196, peHigh: 199, peLow: 194, peClose: 197 },
  ];

  return generateDayFromPoints(date, ceStrike, peStrike, points);
}

/**
 * Day 6: 2026-09-08 (Tuesday) - PE Breakout at 09:34 -> Target Hit at ₹220
 */
function getDay6Candles(): Candle1Min[] {
  const date = '2026-09-08';
  const ceStrike = 25200;
  const peStrike = 24700;

  const points: MinutePricePoint[] = [
    { time: '09:25', ceOpen: 178, ceHigh: 180, ceLow: 176, ceClose: 179, peOpen: 177, peHigh: 179, peLow: 175, peClose: 178 },
    { time: '09:26', ceOpen: 179, ceHigh: 180, ceLow: 177, ceClose: 178, peOpen: 178, peHigh: 179, peLow: 176, peClose: 177 },
    { time: '09:27', ceOpen: 178, ceHigh: 179, ceLow: 176, ceClose: 177, peOpen: 177, peHigh: 178, peLow: 175, peClose: 176 },
    { time: '09:28', ceOpen: 177, ceHigh: 178, ceLow: 175, ceClose: 176, peOpen: 176, peHigh: 177, peLow: 175, peClose: 176.5 },
    { time: '09:29', ceOpen: 176, ceHigh: 177, ceLow: 174, ceClose: 175, peOpen: 176.5, peHigh: 178, peLow: 175.5, peClose: 177 },
    { time: '09:30', ceOpen: 175, ceHigh: 176, ceLow: 173, ceClose: 174, peOpen: 177, peHigh: 178.5, peLow: 176, peClose: 178 },
    { time: '09:31', ceOpen: 174, ceHigh: 175, ceLow: 172, ceClose: 173, peOpen: 178, peHigh: 179.2, peLow: 177, peClose: 178.5 },
    { time: '09:32', ceOpen: 173, ceHigh: 174, ceLow: 171, ceClose: 172, peOpen: 178.5, peHigh: 179.5, peLow: 177.5, peClose: 179 },
    { time: '09:33', ceOpen: 172, ceHigh: 173, ceLow: 170, ceClose: 171, peOpen: 179, peHigh: 179.9, peLow: 178, peClose: 179.8 },
    { time: '09:34', ceOpen: 171, ceHigh: 172, ceLow: 169, ceClose: 170, peOpen: 179.8, peHigh: 184, peLow: 179, peClose: 183.5 }, // PE Crosses!
    { time: '09:35', ceOpen: 170, ceHigh: 171, ceLow: 167, ceClose: 168, peOpen: 183.5, peHigh: 191, peLow: 183, peClose: 190 }, // Entry at Next Open: 183.5
    { time: '09:36', ceOpen: 168, ceHigh: 169, ceLow: 164, ceClose: 165, peOpen: 190, peHigh: 199, peLow: 189, peClose: 198 },
    { time: '09:37', ceOpen: 165, ceHigh: 166, ceLow: 160, ceClose: 161, peOpen: 198, peHigh: 208, peLow: 196, peClose: 206 },
    { time: '09:38', ceOpen: 161, ceHigh: 162, ceLow: 156, ceClose: 157, peOpen: 206, peHigh: 216, peLow: 204, peClose: 214 },
    { time: '09:39', ceOpen: 157, ceHigh: 158, ceLow: 152, ceClose: 153, peOpen: 214, peHigh: 224, peLow: 212, peClose: 222 }, // Target touched (224 >= 220)!
    { time: '09:40', ceOpen: 153, ceHigh: 154, ceLow: 150, ceClose: 151, peOpen: 222, peHigh: 227, peLow: 220, peClose: 225 },
    { time: '09:41', ceOpen: 151, ceHigh: 152, ceLow: 148, ceClose: 149, peOpen: 225, peHigh: 229, peLow: 222, peClose: 227 },
    { time: '09:42', ceOpen: 149, ceHigh: 150, ceLow: 146, ceClose: 147, peOpen: 227, peHigh: 231, peLow: 224, peClose: 229 },
    { time: '09:43', ceOpen: 147, ceHigh: 148, ceLow: 144, ceClose: 145, peOpen: 229, peHigh: 233, peLow: 226, peClose: 231 },
    { time: '09:44', ceOpen: 145, ceHigh: 146, ceLow: 142, ceClose: 143, peOpen: 231, peHigh: 235, peLow: 228, peClose: 233 },
    { time: '09:45', ceOpen: 143, ceHigh: 144, ceLow: 140, ceClose: 141, peOpen: 233, peHigh: 236, peLow: 230, peClose: 234 },
  ];

  return generateDayFromPoints(date, ceStrike, peStrike, points);
}

/**
 * Assembles the standard multi-day sample dataset covering all core test regimes.
 */
export function getSampleOptionData(): Record<string, Candle1Min[]> {
  return {
    '2026-09-01': getDay1Candles(), // CE Target Hit
    '2026-09-02': getDay2Candles(), // PE SL Hit
    '2026-09-03': getDay3Candles(), // CE Time Exit (Profit)
    '2026-09-04': getDay4Candles(), // No Breakout
    '2026-09-07': getDay5Candles(), // Simultaneous Breakout
    '2026-09-08': getDay6Candles(), // PE Target Hit
  };
}
