/**
 * QUANTPULSE — Indian Market-Day Lifecycle State Machine
 * Timezone: Asia/Kolkata (IST = UTC + 05:30)
 * 
 * Formal States:
 *   PRE_MARKET -> MARKET_OPEN_INITIALIZING -> LIVE_SYNC_RUNNING -> LIVE_SYNC_COMPLETED
 *   -> 20D_SYNC_RUNNING -> 20D_SYNC_COMPLETED -> LIVE_FEED_ACTIVE -> MARKET_CLOSING -> MARKET_CLOSED
 *   Exception States: ERROR, RECOVERY
 */

import {
  getISTDate,
  isTradingDay,
  hasTodayMarketSessionStarted,
  hasTodayMarketSessionEnded,
  shouldStopLiveFeed,
  DEFAULT_MARKET_TIMINGS,
  MarketTimingConfig,
} from './marketHoursService';

export type MarketDayState =
  | 'PRE_MARKET'
  | 'MARKET_OPEN_INITIALIZING'
  | 'LIVE_SYNC_RUNNING'
  | 'LIVE_SYNC_COMPLETED'
  | '20D_SYNC_RUNNING'
  | '20D_SYNC_COMPLETED'
  | 'LIVE_FEED_ACTIVE'
  | 'MARKET_CLOSING'
  | 'MARKET_CLOSED'
  | 'ERROR'
  | 'RECOVERY';

export type StageStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'RETRYING';

export interface StateMachineLogEntry {
  timestamp: string;
  fromState: MarketDayState;
  toState: MarketDayState;
  message: string;
  isError?: boolean;
}

export interface MarketLifecycleSnapshot {
  tradingDate: string;
  currentState: MarketDayState;
  tradeMode: 'AUTO' | 'MANUAL';
  initializationStatus: StageStatus;
  liveSyncStatus: StageStatus;
  twentyDaySyncStatus: StageStatus;
  liveFeedStatus: 'STOPPED' | 'CONNECTING' | 'ACTIVE' | 'CLOSING';
  isLiveFeedActive: boolean;
  canExecuteTrades: boolean;
  statusBadge: string;
  badgeVariant: 'emerald' | 'cyan' | 'amber' | 'rose' | 'slate';
  stepDescription: string;
  lastError: string | null;
  retryCount: number;
  maxRetries: number;
  logs: StateMachineLogEntry[];
}

export interface LifecycleTransitionAction {
  action: 'TRIGGER_LIVE_SYNC' | 'TRIGGER_20D_SYNC' | 'START_LIVE_FEED' | 'STOP_LIVE_FEED' | 'RETRY_STAGE' | 'NONE';
  delayMs?: number;
  message?: string;
}

export class MarketLifecycleStateMachine {
  private tradingDate: string;
  private state: MarketDayState = 'PRE_MARKET';
  private tradeMode: 'AUTO' | 'MANUAL' = 'AUTO';
  private initializationStatus: StageStatus = 'PENDING';
  private liveSyncStatus: StageStatus = 'PENDING';
  private twentyDaySyncStatus: StageStatus = 'PENDING';
  private liveFeedStatus: 'STOPPED' | 'CONNECTING' | 'ACTIVE' | 'CLOSING' = 'STOPPED';
  private lastError: string | null = null;
  private retryCount: number = 0;
  private readonly maxRetries: number = 3;
  private logs: StateMachineLogEntry[] = [];
  private lastEvaluatedSeconds: number = 0;
  private timings: MarketTimingConfig = DEFAULT_MARKET_TIMINGS;

  constructor(initialTradingDate?: string, initialMode: 'AUTO' | 'MANUAL' = 'AUTO') {
    this.tradingDate = initialTradingDate || getISTDate().dateStr;
    this.tradeMode = initialMode;
    this.checkInitialState();
  }

  private logTransition(toState: MarketDayState, message: string, isError = false) {
    const { timeStr } = getISTDate();
    const entry: StateMachineLogEntry = {
      timestamp: `${timeStr} IST`,
      fromState: this.state,
      toState,
      message,
      isError,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 100) this.logs.pop();
    console.log(`[MarketStateMachine] [${entry.timestamp}] ${this.state} -> ${toState}: ${message}`);
  }

  public setTradeMode(mode: 'AUTO' | 'MANUAL') {
    this.tradeMode = mode;
  }

  public getSnapshot(): MarketLifecycleSnapshot {
    const isLiveFeedActive = this.state === 'LIVE_FEED_ACTIVE';
    const canExecuteTrades =
      this.tradeMode === 'AUTO' &&
      this.state === 'LIVE_FEED_ACTIVE' &&
      this.initializationStatus === 'SUCCESS';

    let statusBadge = 'PRE-MARKET';
    let badgeVariant: 'emerald' | 'cyan' | 'amber' | 'rose' | 'slate' = 'cyan';
    let stepDescription = 'Waiting for 09:15 IST Market Open';

    switch (this.state) {
      case 'PRE_MARKET':
        statusBadge = 'PRE-MARKET';
        badgeVariant = 'slate';
        stepDescription = 'Awaiting 09:15 Opening Bell (Zero Intraday Shares)';
        break;
      case 'MARKET_OPEN_INITIALIZING':
        statusBadge = 'MARKET OPENING';
        badgeVariant = 'amber';
        stepDescription = 'Opening bell sounded — Initiating Auto Market-Day sequence';
        break;
      case 'LIVE_SYNC_RUNNING':
        statusBadge = 'STEP 1: LIVE SYNC';
        badgeVariant = 'amber';
        stepDescription = 'Validating current-day market quotes & prices (8-Point Gate)';
        break;
      case 'LIVE_SYNC_COMPLETED':
        statusBadge = 'LIVE SYNC DONE';
        badgeVariant = 'cyan';
        stepDescription = 'Current-day quotes verified. Starting 20D Average calculation';
        break;
      case '20D_SYNC_RUNNING':
        statusBadge = 'STEP 2: 20D SYNC';
        badgeVariant = 'amber';
        stepDescription = 'Calculating 20-Day Average Traded Shares baselines';
        break;
      case '20D_SYNC_COMPLETED':
        statusBadge = '20D SYNC DONE';
        badgeVariant = 'cyan';
        stepDescription = '20D Baselines verified. Ready to activate live feed';
        break;
      case 'LIVE_FEED_ACTIVE':
        statusBadge = 'LIVE FEED ACTIVE';
        badgeVariant = 'emerald';
        stepDescription = 'Streaming live ticks, tracking 20D crossovers & auto-trading';
        break;
      case 'MARKET_CLOSING':
        statusBadge = 'MARKET CLOSING';
        badgeVariant = 'amber';
        stepDescription = 'Continuous session closed at 15:30 IST. Stopping signals';
        break;
      case 'MARKET_CLOSED':
        statusBadge = 'MARKET CLOSED';
        badgeVariant = 'rose';
        stepDescription = 'Live feed stopped at 15:31 IST. Market session completed';
        break;
      case 'RECOVERY':
        statusBadge = `RETRYING (${this.retryCount}/${this.maxRetries})`;
        badgeVariant = 'amber';
        stepDescription = `Recovering from transient issue: ${this.lastError || 'Re-evaluating'}`;
        break;
      case 'ERROR':
        statusBadge = 'INITIALIZATION ERROR';
        badgeVariant = 'rose';
        stepDescription = `Fatal error: ${this.lastError || 'Manual intervention required'}`;
        break;
    }

    return {
      tradingDate: this.tradingDate,
      currentState: this.state,
      tradeMode: this.tradeMode,
      initializationStatus: this.initializationStatus,
      liveSyncStatus: this.liveSyncStatus,
      twentyDaySyncStatus: this.twentyDaySyncStatus,
      liveFeedStatus: this.liveFeedStatus,
      isLiveFeedActive,
      canExecuteTrades,
      statusBadge,
      badgeVariant,
      stepDescription,
      lastError: this.lastError,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      logs: [...this.logs],
    };
  }

  /**
   * Evaluates the current state on every second tick and determines the next autonomous action.
   */
  public evaluateTick(nowSeconds?: number): LifecycleTransitionAction {
    const ist = getISTDate();
    const secs = nowSeconds !== undefined ? nowSeconds : ist.hours * 3600 + ist.minutes * 60 + ist.seconds;
    this.lastEvaluatedSeconds = secs;

    // Date Rollover check: If date has changed, reset state machine for the new trading day
    if (ist.dateStr !== this.tradingDate) {
      this.tradingDate = ist.dateStr;
      this.resetForNewDay();
    }

    const { isTradingDay: tradingDay, reason: closedReason } = isTradingDay();

    // 1. Weekend / Holiday Enforcement
    if (!tradingDay) {
      if (this.state !== 'MARKET_CLOSED') {
        this.transitionTo('MARKET_CLOSED', closedReason || 'Non-trading day');
        this.liveFeedStatus = 'STOPPED';
        return { action: 'STOP_LIVE_FEED', message: closedReason };
      }
      return { action: 'NONE' };
    }

    // 2. Post-Market Automated Feed Stop (>= 15:31:00 IST)
    if (secs >= this.timings.feedStopSeconds) {
      if (this.state === 'LIVE_FEED_ACTIVE' || this.state === 'MARKET_CLOSING') {
        this.transitionTo('MARKET_CLOSED', 'Session shutdown reached (15:31 IST). Automatically stopping live feed.');
        this.liveFeedStatus = 'STOPPED';
        return { action: 'STOP_LIVE_FEED', message: 'Auto Stop Feed @ 15:31 IST' };
      }
      if (this.state !== 'MARKET_CLOSED') {
        this.state = 'MARKET_CLOSED';
        this.liveFeedStatus = 'STOPPED';
      }
      return { action: 'NONE' };
    }

    // 3. Regular Session Close Window (15:30:00 to 15:31:00 IST)
    if (secs >= this.timings.marketCloseSeconds && secs < this.timings.feedStopSeconds) {
      if (this.state === 'LIVE_FEED_ACTIVE') {
        this.transitionTo('MARKET_CLOSING', 'Continuous trading ended (15:30 IST). Preparing feed shutdown.');
        this.liveFeedStatus = 'CLOSING';
      }
      return { action: 'NONE' };
    }

    // 4. Pre-Market Window (< 09:15:00 IST)
    if (secs < this.timings.marketOpenSeconds) {
      if (this.state !== 'PRE_MARKET') {
        this.state = 'PRE_MARKET';
        this.liveFeedStatus = 'STOPPED';
      }
      return { action: 'NONE' };
    }

    // 5. Market Open (>= 09:15:00 IST) Autonomous Pipeline
    if (secs >= this.timings.marketOpenSeconds && secs < this.timings.marketCloseSeconds) {
      // If we are currently PRE_MARKET, begin initialization sequence immediately
      if (this.state === 'PRE_MARKET') {
        this.transitionTo('MARKET_OPEN_INITIALIZING', 'Market opened at 09:15 IST. Automatically beginning data initialization.');
        this.initializationStatus = 'RUNNING';
        return { action: 'TRIGGER_LIVE_SYNC', message: 'Beginning Step 1: Live Sync' };
      }

      if (this.state === 'MARKET_OPEN_INITIALIZING') {
        this.transitionTo('LIVE_SYNC_RUNNING', 'Starting Step 1: Live Sync (Current-day quotes & prices).');
        this.liveSyncStatus = 'RUNNING';
        return { action: 'TRIGGER_LIVE_SYNC', message: 'Executing Live Sync' };
      }

      if (this.state === 'LIVE_SYNC_COMPLETED' || this.state === '20D_SYNC_COMPLETED') {
        this.transitionTo('LIVE_FEED_ACTIVE', 'Initialization completed successfully. Connecting Live Feed!');
        this.initializationStatus = 'SUCCESS';
        this.liveFeedStatus = 'ACTIVE';
        return { action: 'START_LIVE_FEED', message: 'Live Feed Connected' };
      }

      // Recovery backoff evaluation
      if (this.state === 'RECOVERY') {
        if (this.retryCount <= this.maxRetries) {
          const backoffDelay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
          if (this.liveSyncStatus !== 'SUCCESS') {
            return { action: 'RETRY_STAGE', delayMs: backoffDelay, message: `Retrying Live Sync (Attempt ${this.retryCount})` };
          } else if (this.twentyDaySyncStatus !== 'SUCCESS') {
            return { action: 'RETRY_STAGE', delayMs: backoffDelay, message: `Retrying 20D Sync (Attempt ${this.retryCount})` };
          }
        } else {
          this.transitionTo('ERROR', `Maximum retry limit (${this.maxRetries}) exceeded. Halting auto sequence.`);
          this.initializationStatus = 'FAILED';
          return { action: 'NONE' };
        }
      }
    }

    return { action: 'NONE' };
  }

  // --- External Stage Completion Hooks ---

  public markLiveSyncSuccess(itemCount: number) {
    this.liveSyncStatus = 'SUCCESS';
    this.retryCount = 0;
    this.lastError = null;
    this.transitionTo('LIVE_SYNC_COMPLETED', `Live Sync validated for ${itemCount} stocks.`);
  }

  public markLiveSyncFailure(errorMsg: string) {
    this.liveSyncStatus = 'FAILED';
    this.lastError = errorMsg;
    this.retryCount++;
    if (this.retryCount <= this.maxRetries) {
      this.transitionTo('RECOVERY', `Live Sync failed (${errorMsg}). Retrying (${this.retryCount}/${this.maxRetries})...`, true);
    } else {
      this.transitionTo('ERROR', `Live Sync failed permanently: ${errorMsg}`, true);
      this.initializationStatus = 'FAILED';
    }
  }

  public mark20DSyncSuccess(itemCount: number) {
    this.twentyDaySyncStatus = 'SUCCESS';
    this.retryCount = 0;
    this.lastError = null;
    this.transitionTo('20D_SYNC_COMPLETED', `20D Traded Shares baseline calculated for ${itemCount} stocks.`);
  }

  public mark20DSyncFailure(errorMsg: string) {
    this.twentyDaySyncStatus = 'FAILED';
    this.lastError = errorMsg;
    this.retryCount++;
    if (this.retryCount <= this.maxRetries) {
      this.transitionTo('RECOVERY', `20D Sync failed (${errorMsg}). Retrying (${this.retryCount}/${this.maxRetries})...`, true);
    } else {
      this.transitionTo('ERROR', `20D Sync failed permanently: ${errorMsg}`, true);
      this.initializationStatus = 'FAILED';
    }
  }

  public markLiveFeedStarted() {
    this.liveFeedStatus = 'ACTIVE';
    this.logTransition('LIVE_FEED_ACTIVE', 'Live market feed actively streaming ticks.');
  }

  public markLiveFeedStopped() {
    this.liveFeedStatus = 'STOPPED';
    if (this.state === 'LIVE_FEED_ACTIVE' || this.state === 'MARKET_CLOSING') {
      this.transitionTo('MARKET_CLOSED', 'Live feed stopped. Market session archived.');
    }
  }

  /**
   * Hydrates state machine from persistent database record on application boot or reload.
   */
  public hydrateFromDatabase(sessionRecord: any) {
    if (!sessionRecord) return;
    if (sessionRecord.trading_date === this.tradingDate) {
      if (sessionRecord.market_state) this.state = sessionRecord.market_state as MarketDayState;
      if (sessionRecord.initialization_status) this.initializationStatus = sessionRecord.initialization_status as StageStatus;
      if (sessionRecord.live_sync_status) this.liveSyncStatus = sessionRecord.live_sync_status as StageStatus;
      if (sessionRecord.twenty_day_sync_status) this.twentyDaySyncStatus = sessionRecord.twenty_day_sync_status as StageStatus;
      if (sessionRecord.live_feed_status) this.liveFeedStatus = sessionRecord.live_feed_status;
      if (sessionRecord.trade_mode) this.tradeMode = sessionRecord.trade_mode;
      if (sessionRecord.retry_count !== undefined) this.retryCount = sessionRecord.retry_count;
      if (sessionRecord.last_error) this.lastError = sessionRecord.last_error;
      this.logTransition(this.state, 'Hydrated state machine from persistent database session.');
    }
  }

  private transitionTo(nextState: MarketDayState, message: string, isError = false) {
    this.logTransition(nextState, message, isError);
    this.state = nextState;
  }

  private resetForNewDay() {
    this.state = 'PRE_MARKET';
    this.initializationStatus = 'PENDING';
    this.liveSyncStatus = 'PENDING';
    this.twentyDaySyncStatus = 'PENDING';
    this.liveFeedStatus = 'STOPPED';
    this.retryCount = 0;
    this.lastError = null;
    this.logTransition('PRE_MARKET', `Rollover to new trading day: ${this.tradingDate}`);
  }

  private checkInitialState() {
    const { isTradingDay: tradingDay } = isTradingDay();
    const ist = getISTDate();
    const secs = ist.hours * 3600 + ist.minutes * 60 + ist.seconds;

    if (!tradingDay || secs >= this.timings.feedStopSeconds) {
      this.state = 'MARKET_CLOSED';
      this.liveFeedStatus = 'STOPPED';
    } else if (secs < this.timings.marketOpenSeconds) {
      this.state = 'PRE_MARKET';
      this.liveFeedStatus = 'STOPPED';
    } else {
      // Application launched during active market hours: arm for immediate initialization
      this.state = 'PRE_MARKET';
    }
  }
}
