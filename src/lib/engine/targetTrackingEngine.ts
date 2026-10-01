/**
 * QUANTPULSE — Mathematical Pi % Target Tracking & Reporting Engine
 * 
 * Target Progression:
 *   T1 = Buy Value + Pi%
 *   T2 = Buy Value + Pi% + Pi%/2
 *   T3 = Buy Value + Pi% + Pi%
 *   T4 = Buy Value + Pi% + Pi% + Pi%/2
 * 
 * Configurable Pi % (Default: 3.1416%)
 */

import { TradeLog, Position, TargetPerformanceReport } from '../types/quant';
import { getISTDate } from '../services/marketHoursService';

export const DEFAULT_PI_PCT = 3.1416; // Standard mathematical Pi % (configurable)

export interface TargetLevels {
  piPct: number;
  buyValue: number;
  entryPrice: number;
  quantity: number;
  // Per-unit target trigger prices
  target1Price: number;
  target2Price: number;
  target3Price: number;
  target4Price: number;
  // Total trade value targets
  target1Value: number;
  target2Value: number;
  target3Value: number;
  target4Value: number;
}

/**
 * Calculates the exact Pi% target levels for a trade.
 */
export function calculateTargetLevels(
  entryPrice: number,
  quantity: number,
  customPiPct?: number
): TargetLevels {
  const piPct = customPiPct !== undefined && customPiPct > 0 ? customPiPct : DEFAULT_PI_PCT;
  const buyValue = +(entryPrice * quantity).toFixed(2);

  // Per-unit multiplier progression
  // T1 = +Pi%
  // T2 = +Pi% + Pi%/2 = +1.5 * Pi%
  // T3 = +2 * Pi%
  // T4 = +2.5 * Pi%
  const m1 = 1 + piPct / 100;
  const m2 = 1 + (piPct * 1.5) / 100;
  const m3 = 1 + (piPct * 2.0) / 100;
  const m4 = 1 + (piPct * 2.5) / 100;

  const target1Price = +(entryPrice * m1).toFixed(2);
  const target2Price = +(entryPrice * m2).toFixed(2);
  const target3Price = +(entryPrice * m3).toFixed(2);
  const target4Price = +(entryPrice * m4).toFixed(2);

  const target1Value = +(buyValue * m1).toFixed(2);
  const target2Value = +(buyValue * m2).toFixed(2);
  const target3Value = +(buyValue * m3).toFixed(2);
  const target4Value = +(buyValue * m4).toFixed(2);

  return {
    piPct,
    buyValue,
    entryPrice,
    quantity,
    target1Price,
    target2Price,
    target3Price,
    target4Price,
    target1Value,
    target2Value,
    target3Value,
    target4Value,
  };
}

/**
 * Evaluates the current spot/option LTP against calculated target levels and updates milestone.
 */
export function evaluateTargetMilestone(
  currentLtp: number,
  targets: TargetLevels,
  currentHighest: 'NONE' | 'T1' | 'T2' | 'T3' | 'T4' = 'NONE'
): {
  highestTargetAchieved: 'NONE' | 'T1' | 'T2' | 'T3' | 'T4';
  isNewMilestone: boolean;
  achievedTimestamp?: string;
} {
  let evaluated: 'NONE' | 'T1' | 'T2' | 'T3' | 'T4' = 'NONE';

  if (currentLtp >= targets.target4Price) {
    evaluated = 'T4';
  } else if (currentLtp >= targets.target3Price) {
    evaluated = 'T3';
  } else if (currentLtp >= targets.target2Price) {
    evaluated = 'T2';
  } else if (currentLtp >= targets.target1Price) {
    evaluated = 'T1';
  }

  // Milestones only ratchet upwards
  const rank = { NONE: 0, T1: 1, T2: 2, T3: 3, T4: 4 };
  const currentRank = rank[currentHighest];
  const newRank = rank[evaluated];

  if (newRank > currentRank) {
    const { timeStr } = getISTDate();
    return {
      highestTargetAchieved: evaluated,
      isNewMilestone: true,
      achievedTimestamp: `${timeStr} IST`,
    };
  }

  return {
    highestTargetAchieved: currentHighest,
    isNewMilestone: false,
  };
}

/**
 * Generates Daily, Weekly, and Yearly Trade Performance Reports.
 */
export function generatePerformanceReport(
  tradeLogs: TradeLog[],
  timeframe: 'DAILY' | 'WEEKLY' | 'YEARLY',
  refDate?: Date
): TargetPerformanceReport {
  const { dateStr, istDate } = getISTDate(refDate);

  // Filter trades for the selected timeframe
  const filtered = tradeLogs.filter((trade) => {
    if (!trade.created_at) return true;
    const tradeDate = trade.created_at.slice(0, 10);

    if (timeframe === 'DAILY') {
      return tradeDate === dateStr;
    }

    if (timeframe === 'WEEKLY') {
      // Find start of the current week (Monday)
      const d = new Date(istDate);
      const day = d.getUTCDay();
      const diffToMon = (day === 0 ? -6 : 1) - day;
      const monday = new Date(d.getTime() + diffToMon * 86400000);
      const monStr = monday.toISOString().slice(0, 10);
      return tradeDate >= monStr && tradeDate <= dateStr;
    }

    if (timeframe === 'YEARLY') {
      const yearStr = dateStr.slice(0, 4);
      return tradeDate.startsWith(yearStr);
    }

    return true;
  });

  const totalTrades = filtered.length;
  let t1Count = 0;
  let t2Count = 0;
  let t3Count = 0;
  let t4Count = 0;
  let noTargetCount = 0;
  let grossPnl = 0;

  filtered.forEach((t) => {
    const target = t.highest_target_achieved || 'NONE';
    grossPnl += Number(t.realized_pnl) || 0;

    if (target === 'T4') {
      t4Count++;
      t3Count++;
      t2Count++;
      t1Count++;
    } else if (target === 'T3') {
      t3Count++;
      t2Count++;
      t1Count++;
    } else if (target === 'T2') {
      t2Count++;
      t1Count++;
    } else if (target === 'T1') {
      t1Count++;
    } else {
      noTargetCount++;
    }
  });

  let highestOverall: 'NONE' | 'T1' | 'T2' | 'T3' | 'T4' = 'NONE';
  if (t4Count > 0) highestOverall = 'T4';
  else if (t3Count > 0) highestOverall = 'T3';
  else if (t2Count > 0) highestOverall = 'T2';
  else if (t1Count > 0) highestOverall = 'T1';

  const achievementPct = totalTrades > 0 ? +((t1Count / totalTrades) * 100).toFixed(1) : 0;

  return {
    timeframe,
    totalTrades,
    t1AchievedCount: t1Count,
    t2AchievedCount: t2Count,
    t3AchievedCount: t3Count,
    t4AchievedCount: t4Count,
    highestTargetAchieved: highestOverall,
    noTargetTradesCount: noTargetCount,
    grossPnl: +grossPnl.toFixed(2),
    targetAchievementPercentage: achievementPct,
  };
}
