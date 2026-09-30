/**
 * QUANTPULSE — Pre-Market Auto-Pilot Service
 * Automated Sequence for NSE / BSE Trading Sessions:
 * 
 * Step 1 (09:00:05 IST): 20D Historical Baseline Sync
 * Step 2 (09:00:15 IST): Day Start Session Reset (Zero today's volume, clear yesterday's crossover flags)
 * Step 3 (09:07:30 IST): Pre-Open Discovered Quotes Live Sync (Fetch equilibrium open prices & calibrate ATM Options)
 * Step 4 (09:14:30 IST): Start Live Feed (Connect live feed 30s before 09:15 opening bell)
 * Market Open (09:15:00 IST): Continuous Trading Session Active
 */

import { getISTDate } from './marketHoursService';

export const STEP_1_SYNC_20D_TIME_SEC = 9 * 3600 + 5; // 09:00:05 IST
export const STEP_2_DAY_START_TIME_SEC = 9 * 3600 + 15; // 09:00:15 IST
export const STEP_3_LIVE_SYNC_TIME_SEC = 9 * 3600 + 7 * 60 + 30; // 09:07:30 IST
export const STEP_4_START_FEED_TIME_SEC = 9 * 3600 + 14 * 60 + 30; // 09:14:30 IST
export const MARKET_OPEN_TIME_SEC = 9 * 3600 + 15 * 60; // 09:15:00 IST
export const MARKET_CLOSE_TIME_SEC = 15 * 3600 + 30 * 60; // 15:30:00 IST

export type AutoPilotStepId = 'STEP_1_SYNC_20D' | 'STEP_2_DAY_START' | 'STEP_3_LIVE_SYNC' | 'STEP_4_START_FEED';

export interface AutoPilotStepStatus {
  id: AutoPilotStepId;
  name: string;
  targetTime: string;
  targetSeconds: number;
  description: string;
  completed: boolean;
  completedAt: string | null;
  isRunning: boolean;
}

export interface PreMarketAutoPilotStatus {
  enabled: boolean;
  isWeekday: boolean;
  isPreMarketWindow: boolean; // 08:50 – 09:15 IST
  isMarketOpen: boolean; // 09:15 – 15:30 IST
  currentStepIndex: number; // 0 to 4
  steps: AutoPilotStepStatus[];
  nextStepName: string;
  nextStepCountdownSeconds: number | null;
  countdownFormatted: string;
  statusBadge: string;
  statusColor: 'emerald' | 'cyan' | 'amber' | 'slate' | 'rose';
  allPreMarketDone: boolean;
  lastRunDate: string | null;
}

const STORAGE_KEYS = {
  ENABLED: 'qp_autopilot_enabled',
  LAST_DATE: 'qp_autopilot_last_date',
  STEP_1: 'qp_autopilot_step_1',
  STEP_2: 'qp_autopilot_step_2',
  STEP_3: 'qp_autopilot_step_3',
  STEP_4: 'qp_autopilot_step_4',
};

export function getStoredAutoPilotEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(STORAGE_KEYS.ENABLED);
  return val === null ? true : val === 'true';
}

export function setStoredAutoPilotEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ENABLED, String(enabled));
}

export function loadStoredStepTimestamps(): {
  date: string | null;
  step1: string | null;
  step2: string | null;
  step3: string | null;
  step4: string | null;
} {
  if (typeof window === 'undefined') {
    return { date: null, step1: null, step2: null, step3: null, step4: null };
  }
  return {
    date: localStorage.getItem(STORAGE_KEYS.LAST_DATE),
    step1: localStorage.getItem(STORAGE_KEYS.STEP_1),
    step2: localStorage.getItem(STORAGE_KEYS.STEP_2),
    step3: localStorage.getItem(STORAGE_KEYS.STEP_3),
    step4: localStorage.getItem(STORAGE_KEYS.STEP_4),
  };
}

export function saveStepCompleted(stepId: AutoPilotStepId, timeStr: string, dateStr: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.LAST_DATE, dateStr);
  if (stepId === 'STEP_1_SYNC_20D') localStorage.setItem(STORAGE_KEYS.STEP_1, timeStr);
  if (stepId === 'STEP_2_DAY_START') localStorage.setItem(STORAGE_KEYS.STEP_2, timeStr);
  if (stepId === 'STEP_3_LIVE_SYNC') localStorage.setItem(STORAGE_KEYS.STEP_3, timeStr);
  if (stepId === 'STEP_4_START_FEED') localStorage.setItem(STORAGE_KEYS.STEP_4, timeStr);
}

export function formatCountdownSec(sec: number): string {
  if (sec <= 0) return '00:00';
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
}

/**
 * Calculates current status and evaluates whether any automated step needs execution.
 */
export function evaluateAutoPilot(
  nowSeconds: number,
  isLiveStreaming: boolean,
  runningStep: AutoPilotStepId | null = null
): {
  status: PreMarketAutoPilotStatus;
  shouldTriggerStep: AutoPilotStepId | null;
} {
  const ist = getISTDate();
  const isWeekday = ist.dayOfWeek >= 1 && ist.dayOfWeek <= 5;
  const todayStr = ist.dateStr;
  const enabled = getStoredAutoPilotEnabled();

  const stored = loadStoredStepTimestamps();
  const isSameDay = stored.date === todayStr;

  const step1Done = isSameDay && Boolean(stored.step1);
  const step2Done = isSameDay && Boolean(stored.step2);
  const step3Done = isSameDay && Boolean(stored.step3);
  const step4Done = (isSameDay && Boolean(stored.step4)) || isLiveStreaming;

  const isPreMarketWindow = nowSeconds >= 8 * 3600 + 45 * 60 && nowSeconds < MARKET_OPEN_TIME_SEC;
  const isMarketOpen = nowSeconds >= MARKET_OPEN_TIME_SEC && nowSeconds < MARKET_CLOSE_TIME_SEC;

  const steps: AutoPilotStepStatus[] = [
    {
      id: 'STEP_1_SYNC_20D',
      name: '20D Baseline Sync',
      targetTime: '09:00:05 AM',
      targetSeconds: STEP_1_SYNC_20D_TIME_SEC,
      description: 'Calculates 20-day historical volume benchmark for each stock from previous sessions.',
      completed: step1Done,
      completedAt: isSameDay ? stored.step1 : null,
      isRunning: runningStep === 'STEP_1_SYNC_20D',
    },
    {
      id: 'STEP_2_DAY_START',
      name: 'Day Start Session Reset',
      targetTime: '09:00:15 AM',
      targetSeconds: STEP_2_DAY_START_TIME_SEC,
      description: 'Zeroes today traded volume, clears yesterday crossover timestamps, arms session.',
      completed: step2Done,
      completedAt: isSameDay ? stored.step2 : null,
      isRunning: runningStep === 'STEP_2_DAY_START',
    },
    {
      id: 'STEP_3_LIVE_SYNC',
      name: 'Pre-Open Quotes Live Sync',
      targetTime: '09:07:30 AM',
      targetSeconds: STEP_3_LIVE_SYNC_TIME_SEC,
      description: 'Fetches NSE pre-open discovered opening prices & calibrates ATM Option strikes.',
      completed: step3Done,
      completedAt: isSameDay ? stored.step3 : null,
      isRunning: runningStep === 'STEP_3_LIVE_SYNC',
    },
    {
      id: 'STEP_4_START_FEED',
      name: 'Start Live Feed',
      targetTime: '09:14:30 AM',
      targetSeconds: STEP_4_START_FEED_TIME_SEC,
      description: 'Connects live data feed pipeline 30s before opening bell for zero-latency execution.',
      completed: step4Done,
      completedAt: isSameDay ? stored.step4 : isLiveStreaming ? 'Active' : null,
      isRunning: runningStep === 'STEP_4_START_FEED',
    },
  ];

  let currentStepIndex = 0;
  if (step1Done) currentStepIndex = 1;
  if (step2Done) currentStepIndex = 2;
  if (step3Done) currentStepIndex = 3;
  if (step4Done) currentStepIndex = 4;

  const allPreMarketDone = step1Done && step2Done && step3Done && step4Done;

  // Determine next step and countdown
  let nextStepName = 'Pre-Market Sequence Complete';
  let nextStepCountdownSeconds: number | null = null;
  let statusBadge = 'Auto-Pilot Ready';
  let statusColor: 'emerald' | 'cyan' | 'amber' | 'slate' | 'rose' = 'cyan';

  if (!enabled) {
    statusBadge = 'Auto-Pilot Paused';
    statusColor = 'slate';
    nextStepName = 'Auto-Pilot Disabled (Manual Mode)';
  } else if (!isWeekday) {
    statusBadge = 'Weekend (Paused)';
    statusColor = 'slate';
    nextStepName = 'NSE Closed for Weekend (Resumes Mon 09:00)';
  } else if (isMarketOpen) {
    statusBadge = isLiveStreaming ? 'Market Open • Feed Active' : 'Market Open • Live Feed Paused';
    statusColor = isLiveStreaming ? 'emerald' : 'amber';
    nextStepName = 'Continuous Market Session Active (09:15 - 15:30)';
  } else if (nowSeconds < STEP_1_SYNC_20D_TIME_SEC) {
    nextStepName = 'Step 1: 09:00 20D Baseline Sync';
    nextStepCountdownSeconds = STEP_1_SYNC_20D_TIME_SEC - nowSeconds;
    statusBadge = `Next: 20D Sync in ${formatCountdownSec(nextStepCountdownSeconds)}`;
    statusColor = 'cyan';
  } else if (!step1Done) {
    nextStepName = 'Step 1: 20D Baseline Sync Pending';
    statusBadge = 'Syncing 20D Baselines...';
    statusColor = 'amber';
  } else if (!step2Done) {
    nextStepName = 'Step 2: Day Start Session Reset Pending';
    statusBadge = 'Initializing Day Start...';
    statusColor = 'amber';
  } else if (nowSeconds < STEP_3_LIVE_SYNC_TIME_SEC) {
    nextStepName = 'Step 3: 09:07 Pre-Open Live Sync';
    nextStepCountdownSeconds = STEP_3_LIVE_SYNC_TIME_SEC - nowSeconds;
    statusBadge = `Next: Live Sync in ${formatCountdownSec(nextStepCountdownSeconds)}`;
    statusColor = 'cyan';
  } else if (!step3Done) {
    nextStepName = 'Step 3: Pre-Open Live Sync Pending';
    statusBadge = 'Syncing Discovered Quotes...';
    statusColor = 'amber';
  } else if (nowSeconds < STEP_4_START_FEED_TIME_SEC) {
    nextStepName = 'Step 4: 09:14 Start Live Feed';
    nextStepCountdownSeconds = STEP_4_START_FEED_TIME_SEC - nowSeconds;
    statusBadge = `Next: Feed Start in ${formatCountdownSec(nextStepCountdownSeconds)}`;
    statusColor = 'amber';
  } else if (!step4Done) {
    nextStepName = 'Step 4: Connecting Live Feed';
    statusBadge = 'Connecting Live Feed...';
    statusColor = 'amber';
  } else {
    const untilOpen = Math.max(0, MARKET_OPEN_TIME_SEC - nowSeconds);
    if (untilOpen > 0) {
      statusBadge = `Armed • Open in ${formatCountdownSec(untilOpen)}`;
      statusColor = 'emerald';
      nextStepName = `Ready for 09:15 Opening Bell (${formatCountdownSec(untilOpen)})`;
    } else {
      statusBadge = 'Market Open • Live Feed Active';
      statusColor = 'emerald';
      nextStepName = 'Continuous Market Session Active';
    }
  }

  // Trigger determination: check if an automated step should execute now
  let shouldTriggerStep: AutoPilotStepId | null = null;

  if (enabled && isWeekday && runningStep === null) {
    // 1. Step 1 (09:00:05 onwards, or catch-up before market open)
    if (nowSeconds >= STEP_1_SYNC_20D_TIME_SEC && nowSeconds < MARKET_CLOSE_TIME_SEC && !step1Done) {
      shouldTriggerStep = 'STEP_1_SYNC_20D';
    }
    // 2. Step 2 (immediately after Step 1 is done)
    else if (step1Done && !step2Done) {
      shouldTriggerStep = 'STEP_2_DAY_START';
    }
    // 3. Step 3 (09:07:30 onwards)
    else if (step1Done && step2Done && nowSeconds >= STEP_3_LIVE_SYNC_TIME_SEC && nowSeconds < MARKET_CLOSE_TIME_SEC && !step3Done) {
      shouldTriggerStep = 'STEP_3_LIVE_SYNC';
    }
    // 4. Step 4 (09:14:30 onwards - auto-start feed)
    else if (step1Done && step2Done && nowSeconds >= STEP_4_START_FEED_TIME_SEC && nowSeconds < MARKET_CLOSE_TIME_SEC && !step4Done && !isLiveStreaming) {
      shouldTriggerStep = 'STEP_4_START_FEED';
    }
  }

  return {
    status: {
      enabled,
      isWeekday,
      isPreMarketWindow,
      isMarketOpen,
      currentStepIndex,
      steps,
      nextStepName,
      nextStepCountdownSeconds,
      countdownFormatted: nextStepCountdownSeconds ? formatCountdownSec(nextStepCountdownSeconds) : '',
      statusBadge,
      statusColor,
      allPreMarketDone,
      lastRunDate: stored.date,
    },
    shouldTriggerStep,
  };
}
