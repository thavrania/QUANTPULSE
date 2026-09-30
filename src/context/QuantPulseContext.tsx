'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Stock,
  CrossoverEvent,
  Position,
  SystemConfig,
  InstrumentMode,
  ExecutionMode,
  BrokerVaultStatus,
  StockMasterItem,
} from '@/lib/types/quant';
import {
  getStockMasterByTicker,
  convertMasterToStock,
  resolveStockMetadata,
  normalizeTicker,
} from '@/lib/stocks/stockMaster';
import {
  INITIAL_WATCHLIST_DATA,
  INITIAL_CROSSOVER_LOGS,
  formatClockIST,
  checkAndLatchVolumeCrossover,
} from '@/lib/engine/crossoverEngine';
import { buildNextActionPayload } from '@/lib/engine/optionPricing';
import {
  advancePositionMilestone,
  autoUpdatePositionFromTick,
  TslMilestone,
} from '@/lib/engine/tslStateMachine';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  logTradeOrderToCloud,
  logTslTransitionToCloud,
  closeTradeOrderInCloud,
  logBatchTickSnapshotsToCloud,
} from '@/lib/services/supabaseTelemetryService';
import { MarketSessionInfo, getIndianMarketSession, getISTDate, hasTodayMarketSessionStarted } from '@/lib/services/marketHoursService';
import { IngestionTelemetry } from '@/lib/services/liveIngestionEngine';
import { requestQueueEngine } from '@/lib/engine/requestQueueEngine';
import { formatTslAlert, formatOrderAlert, formatAutoPilotAlert, sendTelegramMessage } from '@/lib/alerts/telegramService';
import {
  evaluateAutoPilot,
  PreMarketAutoPilotStatus,
  AutoPilotStepId,
  setStoredAutoPilotEnabled,
  saveStepCompleted,
} from '@/lib/services/preMarketAutoPilotService';

export interface ToastMessage {
  id: string;
  message: string;
  variant: 'info' | 'emerald' | 'amber' | 'rose';
}

interface QuantPulseContextType {
  watchlist: Stock[];
  crossoverEvents: CrossoverEvent[];
  positions: Position[];
  config: SystemConfig;
  selectedTicker: string;
  clockTime: string;
  currentTradingDate: string;
  isBaselineSyncing: boolean;
  isLiveStreaming: boolean;
  toasts: ToastMessage[];
  isJsonModalOpen: boolean;
  isAddStockModalOpen: boolean;
  isBrokerModalOpen: boolean;
  isOptionChainModalOpen: boolean;
  isAlertsModalOpen: boolean;
  isAuthModalOpen: boolean;
  isCloudLogsModalOpen: boolean;
  idempotencyLocks: string[];
  totalMtmPnl: number;
  isSupabaseActive: boolean;
  feedMode: 'DHAN_LIVE' | 'SIMULATION';
  lastLiveSyncTime: string | null;
  isLiveFetching: boolean;
  brokerVaultStatus: BrokerVaultStatus | null;
  refreshBrokerVaultStatus: () => Promise<void>;
  marketSession: MarketSessionInfo;
  ingestionTelemetry: IngestionTelemetry;

  // Actions
  setSelectedTicker: (ticker: string) => void;
  setInstrumentMode: (mode: InstrumentMode) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
  setCapitalPerTrade: (val: number) => void;
  setFeedMode: (mode: 'DHAN_LIVE' | 'SIMULATION') => void;
  syncDailyBaselines: (isDateChange?: boolean, forceRefresh?: boolean) => Promise<void>;
  resetToDayStart: () => Promise<void>;
  clearCrossoverEvents: () => void;
  forceCrossover: (ticker: string) => void;
  executeBuy: (ticker: string, triggeredBy?: ExecutionMode) => void;
  panicKillSwitch: () => void;
  advancePositionState: (posId: string, milestone: TslMilestone) => void;
  addCustomStock: (stock: Omit<Stock, 'hasCrossed20D' | 'crossoverTime' | 'crossoverSpotPrice'>) => void;
  addStockFromMaster: (item: StockMasterItem) => void;
  removeStockFromWatchlist: (ticker: string) => void;
  toggleLiveStream: () => void;
  simulateSingleTick: () => void;
  fetchLiveDhanQuotes: (isManualTrigger?: boolean) => Promise<boolean>;
  refreshLiveQuotesNow: () => Promise<void>;
  resetSimulation: () => void;
  setIsJsonModalOpen: (open: boolean) => void;
  setIsAddStockModalOpen: (open: boolean) => void;
  setIsBrokerModalOpen: (open: boolean) => void;
  setIsOptionChainModalOpen: (open: boolean) => void;
  setIsAlertsModalOpen: (open: boolean) => void;
  setIsAuthModalOpen: (open: boolean) => void;
  setIsCloudLogsModalOpen: (open: boolean) => void;
  removeToast: (id: string) => void;
  showToast: (message: string, variant?: 'info' | 'emerald' | 'amber' | 'rose') => void;
  autoPilotStatus: PreMarketAutoPilotStatus;
  isAutoPilotModalOpen: boolean;
  setIsAutoPilotModalOpen: (open: boolean) => void;
  toggleAutoPilot: () => void;
  runAutoPilotStepNow: (stepId: AutoPilotStepId) => Promise<void>;
}

const QuantPulseContext = createContext<QuantPulseContextType | undefined>(undefined);

export function QuantPulseProvider({ children }: { children: React.ReactNode }) {
  const [watchlist, setWatchlist] = useState<Stock[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedTickersRaw = localStorage.getItem('qp_active_watchlist_tickers');
        if (savedTickersRaw) {
          const tickers: string[] = JSON.parse(savedTickersRaw);
          if (Array.isArray(tickers) && tickers.length > 0) {
            const restored: Stock[] = [];
            tickers.forEach((t) => {
              const master = getStockMasterByTicker(t);
              if (master) {
                restored.push(convertMasterToStock(master));
              } else {
                const init = INITIAL_WATCHLIST_DATA.find((s) => s.ticker === t);
                if (init) restored.push(init);
              }
            });
            if (restored.length > 0) return restored;
          }
        }
      } catch (e) {
        console.warn('Failed to restore active watchlist from localStorage:', e);
      }
    }
    return INITIAL_WATCHLIST_DATA;
  });
  const [crossoverEvents, setCrossoverEvents] = useState<CrossoverEvent[]>(INITIAL_CROSSOVER_LOGS);
  const [positions, setPositions] = useState<Position[]>([]);
  const [config, setConfig] = useState<SystemConfig>({
    instrumentMode: 'STOCK',
    executionMode: 'MANUAL',
    capitalPerTrade: 100000,
    maxOpenPositions: 5,
  });
  const [selectedTicker, setSelectedTicker] = useState<string>('RELIANCE');

  // Exact real-time Indian Standard Time (IST) initialization
  const getNowIstSeconds = () => {
    const { hours, minutes, seconds } = getISTDate();
    return hours * 3600 + minutes * 60 + seconds;
  };

  const [clockSeconds, setClockSeconds] = useState<number>(getNowIstSeconds);
  const [currentTradingDate, setCurrentTradingDate] = useState<string>(() => getISTDate().dateStr);
  const [isBaselineSyncing, setIsBaselineSyncing] = useState<boolean>(false);
  const currentTradingDateRef = useRef<string>(getISTDate().dateStr);
  const hasCheckedInitialDateSyncRef = useRef<boolean>(false);
  const watchlistRef = useRef<Stock[]>(watchlist);

  useEffect(() => {
    watchlistRef.current = watchlist;
  }, [watchlist]);

  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState<boolean>(false);
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState<boolean>(false);
  const [isBrokerModalOpen, setIsBrokerModalOpen] = useState<boolean>(false);
  const [isOptionChainModalOpen, setIsOptionChainModalOpen] = useState<boolean>(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isCloudLogsModalOpen, setIsCloudLogsModalOpen] = useState<boolean>(false);
  const [idempotencyLocks, setIdempotencyLocks] = useState<string[]>([]);
  const [feedMode, setFeedModeState] = useState<'DHAN_LIVE' | 'SIMULATION'>('DHAN_LIVE');
  const [lastLiveSyncTime, setLastLiveSyncTime] = useState<string | null>(null);
  const [isLiveFetching, setIsLiveFetching] = useState<boolean>(false);
  const [brokerVaultStatus, setBrokerVaultStatus] = useState<BrokerVaultStatus | null>(null);
  const [marketSession, setMarketSession] = useState<MarketSessionInfo>(() => getIndianMarketSession());
  const [ingestionTelemetry, setIngestionTelemetry] = useState<IngestionTelemetry>({
    packetsReceived: 0,
    lastLatencyMs: 0,
    lastSyncTimestamp: 'Connecting...',
    errorCount: 0,
    streamActive: false,
    pulseIntervalMs: 2000,
  });

  const [autoPilotStatus, setAutoPilotStatus] = useState<PreMarketAutoPilotStatus>(() =>
    evaluateAutoPilot(getNowIstSeconds(), false).status
  );
  const [isAutoPilotModalOpen, setIsAutoPilotModalOpen] = useState<boolean>(false);
  const runningAutoPilotStepRef = useRef<AutoPilotStepId | null>(null);
  const executeAutoPilotStepRef = useRef<((stepId: AutoPilotStepId) => Promise<void>) | null>(null);

  const packetCountRef = useRef<number>(0);
  const streamTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isLiveStreamingRef = useRef<boolean>(false);
  useEffect(() => {
    isLiveStreamingRef.current = isLiveStreaming;
  }, [isLiveStreaming]);

  const positionsRef = useRef<Position[]>(positions);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  const idempotencyLocksRef = useRef<string[]>(idempotencyLocks);
  useEffect(() => {
    idempotencyLocksRef.current = idempotencyLocks;
  }, [idempotencyLocks]);

  const clockSecondsRef = useRef<number>(clockSeconds);
  useEffect(() => {
    clockSecondsRef.current = clockSeconds;
  }, [clockSeconds]);

  const marketSessionRef = useRef<MarketSessionInfo>(marketSession);
  useEffect(() => {
    marketSessionRef.current = marketSession;
  }, [marketSession]);

  const isSelfUpdatingRef = useRef<boolean>(false);
  const selfUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const markSelfUpdating = useCallback(() => {
    isSelfUpdatingRef.current = true;
    if (selfUpdateTimeoutRef.current) clearTimeout(selfUpdateTimeoutRef.current);
    selfUpdateTimeoutRef.current = setTimeout(() => {
      isSelfUpdatingRef.current = false;
    }, 1500);
  }, []);

  const refreshBrokerVaultStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/broker/vault');
      const data = await res.json();
      if (data.success && data.data) {
        setBrokerVaultStatus(data.data);

        // Auto-auth: If local storage has empty credentials but vault is configured, restore to localStorage
        if (typeof window !== 'undefined' && data.data.isConfigured && data.data.source === 'VAULT') {
          const currentToken = localStorage.getItem('qp_dhan_access_token');
          if (!currentToken && data.data.clientId) {
            localStorage.setItem('qp_dhan_client_id', data.data.clientId);
            if (data.data.tokenExpiryAt) {
              localStorage.setItem('qp_token_expiry_at', data.data.tokenExpiryAt);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error refreshing broker vault:', err);
    }
  }, []);

  // Periodic broker vault countdown & status refresh (every 30 seconds)
  useEffect(() => {
    refreshBrokerVaultStatus();
    const interval = setInterval(() => {
      refreshBrokerVaultStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshBrokerVaultStatus]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedFeedMode = localStorage.getItem('qp_feed_mode') as 'DHAN_LIVE' | 'SIMULATION';
      if (savedFeedMode) setFeedModeState(savedFeedMode);
    }
  }, []);

  const setFeedMode = useCallback((mode: 'DHAN_LIVE' | 'SIMULATION') => {
    setFeedModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('qp_feed_mode', mode);
    }
  }, []);

  const recentToastsRef = useRef<Map<string, number>>(new Map());

  const showToast = useCallback(
    (message: string, variant: 'info' | 'emerald' | 'amber' | 'rose' = 'info') => {
      // Deduplicate: Suppress identical toast messages within 8 seconds
      const now = Date.now();
      const lastShown = recentToastsRef.current.get(message);
      if (lastShown && now - lastShown < 8000) {
        return;
      }
      recentToastsRef.current.set(message, now);

      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3800);
    },
    []
  );

  // Circuit Breaker auto-pause listener
  useEffect(() => {
    const unsub = requestQueueEngine.onTrip((state) => {
      setIsLiveStreaming(false);
      showToast(`Stream Paused: ${state.reason}`, 'amber');
    });
    return unsub;
  }, [showToast]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const syncDailyBaselines = useCallback(
    async (isDateChange = false, forceRefresh = false) => {
      try {
        setIsBaselineSyncing(true);
        const todayDateStr = getISTDate().dateStr;
        const clientId = typeof window !== 'undefined' ? localStorage.getItem('qp_dhan_client_id') || '' : '';
        const accessToken = typeof window !== 'undefined' ? localStorage.getItem('qp_dhan_access_token') || '' : '';
        const currentTickers = watchlistRef.current.map((s) => s.ticker);

        const baselineMap = new Map<string, number>();
        let dataSource = 'QUANT_BASELINE_ENGINE';

        try {
          const res = await fetch('/api/pipeline/sync-baselines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, accessToken, tickers: currentTickers }),
          });

          const data = await res.json();
          if (data && data.success && data.baselines && data.baselines.length > 0) {
            data.baselines.forEach((b: any) => {
              baselineMap.set(b.ticker, b.avgVolume20DM);
            });
            dataSource = data.dataSource || 'DHAN_HISTORICAL_API';
          }
        } catch (apiErr) {
          console.warn('Backend baseline sync API notice, activating quantitative baseline fallback:', apiErr);
        }

        // Complete any missing tickers using high-fidelity 20-day historical catalog
        watchlistRef.current.forEach((stock) => {
          if (!baselineMap.has(stock.ticker)) {
            const master = getStockMasterByTicker(stock.ticker);
            const baseAvg = master?.avgVol20DM || stock.avgVol20DM || 5.0;
            baselineMap.set(stock.ticker, baseAvg);
          }
        });

        const nowSecs = getNowIstSeconds();
        const currentClockStr = formatClockIST(nowSecs);
        const sessionStarted = hasTodayMarketSessionStarted();

        setWatchlist((prevWl) =>
          prevWl.map((stock) => {
            const newAvg20D = baselineMap.get(stock.ticker) ?? stock.avgVol20DM;
            if (isDateChange) {
              // Day Start / Date Rollover:
              // If continuous trading has not started today (e.g. pre-market or closed), Traded Shares is strictly 0.0
              // Do not fall back to previous trading day's traded shares or mock data.
              const dayStartVol = sessionStarted ? stock.todayVolM : 0.0;
              const hasCrossed = sessionStarted && dayStartVol >= newAvg20D && dayStartVol > 0;
              return {
                ...stock,
                avgVol20DM: newAvg20D,
                todayVolM: dayStartVol,
                hasCrossed20D: hasCrossed,
                crossoverTime: hasCrossed ? stock.crossoverTime : null,
                crossoverSpotPrice: hasCrossed ? stock.crossoverSpotPrice : null,
                justCrossedHighlight: false,
              };
            } else {
              // Mid-day refresh: keep today's traded shares and re-evaluate crossover eligibility against new 20D baseline
              const hasCrossed = sessionStarted && stock.todayVolM >= newAvg20D && stock.todayVolM > 0;
              return {
                ...stock,
                avgVol20DM: newAvg20D,
                hasCrossed20D: hasCrossed,
                crossoverTime: hasCrossed ? (stock.crossoverTime || currentClockStr) : null,
                crossoverSpotPrice: hasCrossed ? (stock.crossoverSpotPrice || stock.spotLtp) : null,
              };
            }
          })
        );

        if (isDateChange) {
          setCrossoverEvents([]);
          setIdempotencyLocks([]);
          if (typeof window !== 'undefined') {
            localStorage.setItem('qp_last_trading_date', todayDateStr);
            localStorage.setItem(
              'qp_active_watchlist_tickers',
              JSON.stringify(watchlistRef.current.map((s) => s.ticker))
            );
          }
          if (isSupabaseConfigured && supabase) {
            markSelfUpdating();
            const client = supabase;
            watchlistRef.current.forEach((stock) => {
              const newAvg = baselineMap.get(stock.ticker) ?? stock.avgVol20DM;
              const updatePayload: Record<string, any> = {
                avg_vol_20d_m: newAvg,
                updated_at: new Date().toISOString(),
              };
              if (!sessionStarted) {
                updatePayload.today_vol_m = 0.0;
                updatePayload.has_crossed_20d = false;
                updatePayload.crossover_time = null;
                updatePayload.crossover_spot_price = null;
              }
              client.from('watchlist').update(updatePayload).eq('ticker', stock.ticker).then();
              client.from('stock_master').update({ avg_vol_20d_m: newAvg }).eq('ticker', stock.ticker).then();
            });
          }
          showToast(
            `📅 Day Start (${todayDateStr}): Last 20-Day Traded Shares baselines updated. Intraday progress initialized for today.`,
            'emerald'
          );
        } else {
          if (typeof window !== 'undefined') {
            localStorage.setItem(
              'qp_active_watchlist_tickers',
              JSON.stringify(watchlistRef.current.map((s) => s.ticker))
            );
          }
          if (isSupabaseConfigured && supabase) {
            markSelfUpdating();
            const client = supabase;
            watchlistRef.current.forEach((stock) => {
              const newAvg = baselineMap.get(stock.ticker) ?? stock.avgVol20DM;
              client.from('watchlist').update({ avg_vol_20d_m: newAvg, updated_at: new Date().toISOString() }).eq('ticker', stock.ticker).then();
              client.from('stock_master').update({ avg_vol_20d_m: newAvg }).eq('ticker', stock.ticker).then();
            });
          }
          showToast(
            `⚡ Last 20-Day Traded Shares baselines refreshed for ${currentTickers.length} symbols (${dataSource}).`,
            'info'
          );
        }
      } catch (err: any) {
        console.error('Failed to sync daily baselines:', err);
        showToast(`Baseline Sync Notice: Local quantitative models active (${err.message})`, 'amber');
      } finally {
        setIsBaselineSyncing(false);
      }
    },
    [showToast]
  );

  const clearCrossoverEvents = useCallback(() => {
    setCrossoverEvents([]);
    if (isSupabaseConfigured && supabase) {
      markSelfUpdating();
      const client = supabase;
      client.from('crossover_events').delete().neq('ticker', 'DUMMY_NEVER_MATCH').then();
    }
    showToast('Exact Crossover Timestamp Feed cleared.', 'info');
  }, [markSelfUpdating, showToast]);

  const clockTime = formatClockIST(clockSeconds);

  // 1. Live IST Clock & Date Rollover Monitor (every 1000ms)
  useEffect(() => {
    const updateClockAndDate = () => {
      const ist = getISTDate();
      const secs = ist.hours * 3600 + ist.minutes * 60 + ist.seconds;
      setClockSeconds(secs);
      setMarketSession(getIndianMarketSession());

      // Pre-Market Auto-Pilot continuous evaluation & scheduled trigger check
      const { status: apStatus, shouldTriggerStep } = evaluateAutoPilot(
        secs,
        isLiveStreamingRef.current,
        runningAutoPilotStepRef.current
      );
      setAutoPilotStatus(apStatus);

      if (shouldTriggerStep && executeAutoPilotStepRef.current) {
        executeAutoPilotStepRef.current(shouldTriggerStep);
      }

      // Midnight date change rollover detection
      if (ist.dateStr !== currentTradingDateRef.current) {
        currentTradingDateRef.current = ist.dateStr;
        setCurrentTradingDate(ist.dateStr);
        // Automatically sync baselines and reset intraday progress for the new calendar date
        syncDailyBaselines(true);
      }
    };

    updateClockAndDate();
    const timer = setInterval(updateClockAndDate, 1000);
    return () => clearInterval(timer);
  }, [syncDailyBaselines]);

  // First Day Start check: if date has changed since last visit, run baseline calculation & session reset
  useEffect(() => {
    if (hasCheckedInitialDateSyncRef.current) return;
    hasCheckedInitialDateSyncRef.current = true;

    const todayDateStr = getISTDate().dateStr;
    const storedDate = typeof window !== 'undefined' ? localStorage.getItem('qp_last_trading_date') : null;

    if (!storedDate || storedDate !== todayDateStr) {
      syncDailyBaselines(true);
    }
  }, [syncDailyBaselines]);

  // 2. Fetch from Supabase if configured
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    async function loadFromSupabase() {
      try {
        const todayDateStr = getISTDate().dateStr;
        // 1. Fetch both watchlist and dedicated stock_master table concurrently
        const [wlRes, smRes] = await Promise.all([
          supabase!.from('watchlist').select('*'),
          supabase!.from('stock_master').select('*'),
        ]);

        const smMap = new Map<string, any>();
        if (smRes.data && Array.isArray(smRes.data)) {
          smRes.data.forEach((item: any) => {
            if (item.ticker) {
              smMap.set(normalizeTicker(item.ticker), item);
            }
          });
        }

        let activeRecords: any[] = wlRes.data || [];

        // If active watchlist table is currently empty in DB, load stocks flagged with is_active_watchlist = true from stock_master
        if (activeRecords.length === 0 && smRes.data) {
          activeRecords = smRes.data.filter((s: any) => Boolean(s.is_active_watchlist));
        }

        if (activeRecords && activeRecords.length > 0) {
          const sessionStarted = hasTodayMarketSessionStarted();
          const mapped: Stock[] = activeRecords.map((d: any) => {
            const cleanTicker = normalizeTicker(d.ticker);
            const dbMaster = smMap.get(cleanTicker);
            const meta = resolveStockMetadata(d, dbMaster);

            let isUpdatedToday = false;
            if (d.updated_at) {
              const dt = new Date(d.updated_at);
              if (!isNaN(dt.getTime())) {
                isUpdatedToday = getISTDate(dt).dateStr === todayDateStr;
              }
            }
            // Before 09:15 IST on trading days or on weekends, today's regular session has not traded.
            // Today's traded volume must remain 0.00M, and crossover cannot trigger!
            const todayVol = (sessionStarted && isUpdatedToday) ? (Number(d.today_vol_m) || 0) : 0;
            const avgVol = Number(d.avg_vol_20d_m) || meta.avgVol20DM || 1.0;
            const spot = Number(d.spot_ltp) || meta.approxLtp || 1000;
            const dayOpen = d.day_open ? Number(d.day_open) : spot;
            const chgPct = d.change_pct !== undefined ? Number(d.change_pct) : 0;
            const isBullish = spot >= dayOpen || chgPct >= 0;

            // Rule 5: Volume must genuinely meet/exceed 20D average (>0) and DB must flag it crossed
            const hasCrossed =
              sessionStarted &&
              isUpdatedToday &&
              Boolean(d.has_crossed_20d) &&
              todayVol >= avgVol &&
              todayVol > 0;

            const existingLocal = (watchlistRef.current || []).find((s) => normalizeTicker(s.ticker) === cleanTicker);
            const localVol = existingLocal?.todayVolM || 0;

            // Rule 5: Auto-clean stale DB records if volume is below 20D average
            // Guard: Only clean if NOT streaming live and in-memory volume is also below avgVol
            if (
              !isLiveStreamingRef.current &&
              d.has_crossed_20d &&
              (todayVol < avgVol || todayVol === 0) &&
              localVol < avgVol
            ) {
              markSelfUpdating();
              const client = supabase;
              client!
                .from('watchlist')
                .update({
                  has_crossed_20d: false,
                  crossover_time: null,
                  crossover_spot_price: null,
                })
                .eq('ticker', d.ticker)
                .then();
            }

            // Auto-heal missing or outdated stock names / metadata in Supabase watchlist table
            if (isSupabaseConfigured && supabase) {
              const needsHealing =
                !d.short_name ||
                d.short_name.toUpperCase() === cleanTicker ||
                d.name !== meta.name ||
                !d.isin ||
                !d.sector;
              if (needsHealing) {
                const client = supabase;
                client
                  .from('watchlist')
                  .update({
                    short_name: meta.shortName,
                    name: meta.name,
                    isin: meta.isin,
                    segment: meta.segment,
                    sector: meta.sector,
                    security_id: meta.securityId,
                    lot_size: meta.lotSize,
                    strike_step: meta.strikeStep,
                  })
                  .eq('ticker', d.ticker)
                  .then();
              }
            }

            // If local state already has newer/active live streaming data, preserve it!
            const preferLocal =
              isLiveStreamingRef.current ||
              (existingLocal !== undefined && existingLocal.todayVolM > todayVol);

            // Once latched, a stock must stay latched unless volume drops below 20D baseline (Day Start)
            const finalHasCrossed = (existingLocal?.hasCrossed20D && localVol >= avgVol) || hasCrossed;
            const finalCrossoverTime =
              existingLocal?.crossoverTime ||
              (finalHasCrossed ? (d.crossover_time || getISTDate().timeStr) : null);
            const finalCrossoverSpot =
              existingLocal?.crossoverSpotPrice ??
              (finalHasCrossed ? Number(d.crossover_spot_price || spot) : null);

            return {
              ticker: meta.ticker,
              shortName: meta.shortName,
              name: meta.name,
              isin: meta.isin,
              isFnO: meta.isFnO,
              segment: meta.segment,
              sector: meta.sector,
              securityId: meta.securityId,
              lotSize: meta.lotSize,
              strikeStep: meta.strikeStep,
              spotLtp: preferLocal && existingLocal ? existingLocal.spotLtp : spot,
              todayVolM: preferLocal && existingLocal ? existingLocal.todayVolM : todayVol,
              avgVol20DM: avgVol,
              hasCrossed20D: finalHasCrossed,
              crossoverTime: finalCrossoverTime,
              crossoverSpotPrice: finalCrossoverSpot,
              ivPct: Number(d.iv_pct || (meta.isFnO ? 16.5 : 0)),
              dayHigh:
                preferLocal && existingLocal?.dayHigh !== undefined
                  ? existingLocal.dayHigh
                  : d.day_high
                  ? Number(d.day_high)
                  : undefined,
              dayLow:
                preferLocal && existingLocal?.dayLow !== undefined
                  ? existingLocal.dayLow
                  : d.day_low
                  ? Number(d.day_low)
                  : undefined,
              dayOpen:
                preferLocal && existingLocal?.dayOpen !== undefined
                  ? existingLocal.dayOpen
                  : d.day_open
                  ? Number(d.day_open)
                  : undefined,
              dayClose:
                preferLocal && existingLocal?.dayClose !== undefined
                  ? existingLocal.dayClose
                  : d.day_close
                  ? Number(d.day_close)
                  : undefined,
              changePct:
                preferLocal && existingLocal?.changePct !== undefined
                  ? existingLocal.changePct
                  : d.change_pct !== undefined
                  ? Number(d.change_pct)
                  : undefined,
              feedSource: preferLocal && existingLocal ? existingLocal.feedSource : (d.feed_source || 'LIVE_DHAN'),
              indices: meta.indices,
            };
          });

          // PRESERVE USER'S WATCHLIST: Do NOT overwrite with hardcoded defaults
          setWatchlist((prevWl) => {
            if (isLiveStreamingRef.current) {
              return prevWl;
            }
            return mapped;
          });

          if (typeof window !== 'undefined') {
            localStorage.setItem(
              'qp_active_watchlist_tickers',
              JSON.stringify(mapped.map((s) => s.ticker))
            );
          }
        }

        const { data: evData } = await supabase!
          .from('crossover_events')
          .select('*')
          .gte('created_at', `${todayDateStr}T00:00:00`)
          .order('created_at', { ascending: true }); // Earliest first to capture the true initial crossover timestamp

        const activeCrossedTickers = new Set(
          (watchlistRef.current || [])
            .filter((s) => s.hasCrossed20D && s.todayVolM >= s.avgVol20DM && s.todayVolM > 0)
            .map((s) => s.ticker)
        );

        // Deduplicate: Enforce strictly at most one entry per stock in the Exact Crossover Timestamp Feed
        const dedupedMap = new Map<string, CrossoverEvent>();

        if (evData && evData.length > 0) {
          evData.forEach((e: any) => {
            if (!activeCrossedTickers.has(e.ticker)) return;
            // Only keep the earliest crossover entry for each stock
            if (dedupedMap.has(e.ticker)) return;

            let eventTime = e.time_ist;
            if (e.created_at) {
              const dt = new Date(e.created_at);
              if (!isNaN(dt.getTime())) {
                eventTime = getISTDate(dt).timeStr;
              }
            }

            dedupedMap.set(e.ticker, {
              id: e.id,
              ticker: e.ticker,
              time: eventTime || getISTDate().timeStr,
              avgVol20DM: Number(e.avg_vol_20d_m),
              crossPrice: Number(e.cross_price) || 0,
              isFnO: Boolean(e.is_fno),
            });
          });
        }

        // Also check active watchlist in memory: If a stock has crossed with crossoverTime, guarantee it has an entry
        (watchlistRef.current || []).forEach((stock) => {
          if (
            stock.hasCrossed20D &&
            stock.crossoverTime &&
            stock.todayVolM >= stock.avgVol20DM &&
            stock.todayVolM > 0 &&
            !dedupedMap.has(stock.ticker)
          ) {
            dedupedMap.set(stock.ticker, {
              ticker: stock.ticker,
              time: stock.crossoverTime,
              avgVol20DM: stock.avgVol20DM,
              crossPrice: stock.crossoverSpotPrice || stock.spotLtp,
              isFnO: stock.isFnO,
            });
          }
        });

        const uniqueEvents = Array.from(dedupedMap.values());

        setCrossoverEvents((prevEv) => {
          // Merge preserving existing timestamps, strictly 1 entry per stock
          const finalMap = new Map<string, CrossoverEvent>();
          // Existing in-memory events have precedence for active stocks
          prevEv.forEach((ev) => {
            if (activeCrossedTickers.has(ev.ticker) && !finalMap.has(ev.ticker)) {
              finalMap.set(ev.ticker, ev);
            }
          });
          // Add any missing from uniqueEvents
          uniqueEvents.forEach((ev) => {
            if (!finalMap.has(ev.ticker)) {
              finalMap.set(ev.ticker, ev);
            }
          });
          return Array.from(finalMap.values());
        });

        const { data: posData } = await supabase!.from('active_positions').select('*').order('created_at', { ascending: false });
        if (posData && posData.length > 0) {
          const mappedPos: Position[] = posData.map((p: any) => ({
            id: p.id,
            orderTime: p.order_time,
            crossoverTime: p.crossover_time,
            ticker: p.ticker,
            executionMode: p.execution_mode,
            instrumentType: p.instrument_type,
            symbol: p.symbol,
            quantity: p.quantity,
            lots: p.lots,
            entryPrice: Number(p.entry_price),
            currentLtp: Number(p.current_ltp),
            riskPerUnit: Number(p.risk_per_unit),
            activeTrailingSl: Number(p.active_trailing_sl),
            targetPrice: Number(p.target_price),
            stateIndex: p.state_index as 1 | 2 | 3 | 4,
            stateLabel: p.state_label,
          }));
          setPositions(mappedPos);
          setIdempotencyLocks(mappedPos.map((p) => p.ticker));
        }
      } catch (err) {
        console.error('Supabase load error:', err);
      }
    }

    loadFromSupabase();

    // Subscribe to realtime changes with self-update echo suppression and live stream lock
    const channel = supabase
      .channel('quantpulse-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watchlist' }, () => {
        if (isSelfUpdatingRef.current || isLiveStreamingRef.current) return;
        loadFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crossover_events' }, () => {
        if (isSelfUpdatingRef.current) return;
        loadFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_positions' }, () => {
        if (isSelfUpdatingRef.current) return;
        loadFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broker_vault' }, () => {
        refreshBrokerVaultStatus();
      })
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, []);

  // 3. Execution logic
  const executeBuy = useCallback(
    async (tickerSymbol: string, triggeredBy: ExecutionMode = 'MANUAL') => {
      const stock = watchlist.find((s) => s.ticker === tickerSymbol);
      if (!stock) return;

      if (!stock.hasCrossed20D) {
        showToast(
          `Cannot Buy ${stock.ticker} yet — Today's volume (${stock.todayVolM}M) has not crossed 20D Avg (${stock.avgVol20DM}M).`,
          'rose'
        );
        return;
      }

      const openLegs = positions.filter((p) => p.stateIndex < 4).length;
      if (openLegs >= config.maxOpenPositions) {
        showToast(`Max Open Positions (${config.maxOpenPositions}) reached!`, 'rose');
        return;
      }

      const payload = buildNextActionPayload(stock, config);
      const useOption =
        payload.toggleConfiguration.effectiveInstrumentMode === 'OPTION' &&
        payload.optionBuyDetails;
      const activeLeg = useOption ? payload.optionBuyDetails! : payload.stockBuyDetails;

      const orderTime = formatClockIST(clockSeconds);
      const newPos: Position = {
        id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
        orderTime,
        crossoverTime: stock.crossoverTime || orderTime,
        ticker: stock.ticker,
        executionMode: triggeredBy,
        instrumentType: activeLeg.instrumentType,
        symbol: activeLeg.symbol,
        quantity: activeLeg.quantity,
        lots: 'lots' in activeLeg ? activeLeg.lots : null,
        entryPrice: activeLeg.entryPrice,
        currentLtp: activeLeg.entryPrice,
        riskPerUnit: 'riskPerUnit' in activeLeg ? activeLeg.riskPerUnit : activeLeg.riskPerShare,
        activeTrailingSl: activeLeg.stopLossPrice,
        targetPrice: activeLeg.targetPrice,
        stateIndex: 1,
        stateLabel: 'State 1: Initial SL (1R)',
      };

      setPositions((prev) => [newPos, ...prev]);
      setIdempotencyLocks((prev) => (prev.includes(stock.ticker) ? prev : [...prev, stock.ticker]));

      showToast(
        `✅ ${triggeredBy} BUY EXECUTED: ${activeLeg.symbol} (${activeLeg.quantity} Qty) @ ₹${activeLeg.entryPrice.toFixed(
          2
        )} [Crossed @ ${newPos.crossoverTime}]`,
        'emerald'
      );

      const isLiveRouting = typeof window !== 'undefined' && localStorage.getItem('qp_order_routing_mode') === 'LIVE';

      // 1. If Live Dhan routing mode is enabled, dispatch live market order to Dhan HQ API
      if (isLiveRouting) {
        const clientId = typeof window !== 'undefined' ? localStorage.getItem('qp_dhan_client_id') || '' : '';
        const accessToken = typeof window !== 'undefined' ? localStorage.getItem('qp_dhan_access_token') || '' : '';
        fetch('/api/broker/dhan/place-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: stock.ticker,
            instrumentType: activeLeg.instrumentType,
            symbol: activeLeg.symbol,
            action: 'BUY',
            quantity: activeLeg.quantity,
            price: activeLeg.entryPrice,
            stopLossPrice: activeLeg.stopLossPrice,
            targetPrice: activeLeg.targetPrice,
            isPaper: false,
            clientId,
            accessToken,
          }),
        }).catch((err) => console.warn('Dhan live order dispatch notification:', err));
      }

      // 2. Persist to Supabase immediately (public.active_positions & public.trade_logs)
      if (isSupabaseConfigured && supabase) {
        markSelfUpdating();
        const client = supabase;
        client.from('active_positions').insert({
          id: newPos.id,
          order_time: newPos.orderTime,
          crossover_time: newPos.crossoverTime,
          ticker: newPos.ticker,
          execution_mode: newPos.executionMode,
          instrument_type: newPos.instrumentType,
          symbol: newPos.symbol,
          quantity: newPos.quantity,
          lots: newPos.lots,
          entry_price: newPos.entryPrice,
          current_ltp: newPos.currentLtp,
          risk_per_unit: newPos.riskPerUnit,
          active_trailing_sl: newPos.activeTrailingSl,
          target_price: newPos.targetPrice,
          state_index: newPos.stateIndex,
          state_label: newPos.stateLabel,
        }).then();

        // Also append permanent audit log to trade_logs
        logTradeOrderToCloud({
          order_id: newPos.id,
          ticker: newPos.ticker,
          symbol: newPos.symbol,
          action: 'BUY',
          instrument_type: newPos.instrumentType,
          routing_mode: isLiveRouting ? 'LIVE_DHAN' : 'PAPER',
          quantity: newPos.quantity,
          lots: newPos.lots,
          entry_price: newPos.entryPrice,
          stop_loss: newPos.activeTrailingSl,
          target_price: newPos.targetPrice,
          crossover_ref_time: newPos.crossoverTime,
          status: 'OPEN',
        });
      }

      // 3. Automated Telegram Order Alert
      if (typeof window !== 'undefined') {
        const botToken = localStorage.getItem('qp_telegram_bot_token');
        const chatId = localStorage.getItem('qp_telegram_chat_id');
        const notifyOrder = localStorage.getItem('qp_notify_order') !== 'false';
        if (botToken && chatId && notifyOrder) {
          const orderMsg = formatOrderAlert(
            activeLeg.symbol,
            `${triggeredBy} BUY`,
            activeLeg.quantity,
            activeLeg.entryPrice,
            newPos.id,
            isLiveRouting ? 'LIVE_DHAN' : 'PAPER'
          );
          fetch('/api/alerts/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              botToken,
              chatId,
              message: orderMsg,
            }),
          }).catch(() => {});
        }
      }
    },
    [watchlist, positions, config, clockSeconds, showToast]
  );

  // Auto-scan trigger
  const runAutoScan = useCallback(
    (currentWl: Stock[], currentLocks: string[], currentPos: Position[]) => {
      if (config.executionMode !== 'AUTO') return;
      currentWl.forEach((stock) => {
        if (stock.hasCrossed20D) {
          if (currentLocks.includes(stock.ticker)) return;
          const openCount = currentPos.filter((p) => p.stateIndex < 4).length;
          if (openCount >= config.maxOpenPositions) return;

          executeBuy(stock.ticker, 'AUTO');
        }
      });
    },
    [config.executionMode, config.maxOpenPositions, executeBuy]
  );

  // 4. Tick Simulation
  const simulateSingleTick = useCallback(() => {
    const timeStr = getISTDate().timeStr;

    setWatchlist((prevWl) => {
      const updatedWl = prevWl.map((stock) => {
        const volStep = +(stock.avgVol20DM * (0.012 + Math.random() * 0.018)).toFixed(3);
        const newTodayVol = +(stock.todayVolM + volStep).toFixed(3);
        const priceDeltaPct = (Math.random() - 0.42) * 0.006;
        const newSpotLtp = Math.max(10, +(stock.spotLtp * (1 + priceDeltaPct)).toFixed(2));
        const dayOpen = stock.dayOpen || stock.spotLtp;
        const newChangePct = +(((newSpotLtp - dayOpen) / dayOpen) * 100).toFixed(2);

        const updated = {
          ...stock,
          todayVolM: newTodayVol,
          spotLtp: newSpotLtp,
          changePct: newChangePct,
        };

        const { newlyCrossed, event } = checkAndLatchVolumeCrossover(updated, timeStr);
        if (newlyCrossed && event) {
          setCrossoverEvents((prevEv) => {
            if (prevEv.some((e) => e.ticker === event.ticker)) {
              return prevEv;
            }
            return [event, ...prevEv];
          });
          showToast(
            `⏱️ [${timeStr}] ${stock.ticker} crossed 20D Avg Vol (${stock.avgVol20DM.toFixed(2)}M) @ ₹${newSpotLtp.toFixed(2)} → ELIGIBLE FOR BUY!`,
            'emerald'
          );

          if (isSupabaseConfigured && supabase) {
            markSelfUpdating();
            const client = supabase;
            const todayStr = getISTDate().dateStr;
            client
              .from('crossover_events')
              .select('id')
              .eq('ticker', event.ticker)
              .gte('created_at', `${todayStr}T00:00:00`)
              .then(({ data: existingRows }) => {
                if (!existingRows || existingRows.length === 0) {
                  client.from('crossover_events').insert({
                    ticker: event.ticker,
                    time_ist: event.time,
                    avg_vol_20d_m: event.avgVol20DM,
                    cross_price: event.crossPrice,
                    is_fno: event.isFnO,
                  }).then();
                }
              });

            client.from('watchlist').update({
              has_crossed_20d: true,
              crossover_time: event.time,
              crossover_spot_price: event.crossPrice,
              spot_ltp: updated.spotLtp,
              today_vol_m: updated.todayVolM,
              change_pct: updated.changePct,
              updated_at: new Date().toISOString(),
            }).eq('ticker', event.ticker).then();
          }

          // Automated Telegram Push Alert
          if (typeof window !== 'undefined') {
            const botToken = localStorage.getItem('qp_telegram_bot_token');
            const chatId = localStorage.getItem('qp_telegram_chat_id');
            const notifyCross = localStorage.getItem('qp_notify_crossover') !== 'false';
            if (botToken && chatId && notifyCross) {
              fetch('/api/alerts/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  botToken,
                  chatId,
                  message: `🚀 *QUANTPULSE 20D CROSSOVER!*\nSymbol: \`${stock.ticker}\`\nTime: \`${timeStr} IST\`\nToday Vol: \`${newTodayVol.toFixed(2)}M\` (vs 20D Avg: \`${stock.avgVol20DM.toFixed(2)}M\`)\nSpot Price: \`₹${newSpotLtp.toFixed(2)}\`\nStatus: 🟢 *ELIGIBLE FOR BUY*`,
                }),
              }).catch(() => {});
            }
          }
        }
        return updated;
      });

      // Check auto-mode dispatch
      runAutoScan(updatedWl, idempotencyLocksRef.current, positionsRef.current);
      return updatedWl;
    });

    setPositions((prevPos) =>
      prevPos.map((pos) => {
        const nextPos = autoUpdatePositionFromTick(pos);
        if (nextPos.stateIndex !== pos.stateIndex) {
          logTslTransitionToCloud({
            position_id: pos.id,
            symbol: pos.symbol,
            from_state: pos.stateIndex,
            to_state: nextPos.stateIndex,
            from_label: pos.stateLabel,
            to_label: nextPos.stateLabel,
            spot_price_at_transition: nextPos.currentLtp,
            new_trailing_sl: nextPos.activeTrailingSl,
            pnl_locked: (nextPos.activeTrailingSl - pos.entryPrice) * pos.quantity,
            timestamp_ist: timeStr,
          });

          if (nextPos.stateIndex === 4) {
            const finalPnl = (nextPos.currentLtp - pos.entryPrice) * pos.quantity;
            closeTradeOrderInCloud(pos.id, nextPos.currentLtp, finalPnl);
          }

          if (isSupabaseConfigured && supabase) {
            markSelfUpdating();
            const client = supabase;
            client
              .from('active_positions')
              .update({
                current_ltp: nextPos.currentLtp,
                active_trailing_sl: nextPos.activeTrailingSl,
                state_index: nextPos.stateIndex,
                state_label: nextPos.stateLabel,
              })
              .eq('id', pos.id)
              .then();
          }

          // Automated Telegram alert for real-time TSL progression (+1R, +2R, +3R/Exit)
          if (typeof window !== 'undefined') {
            const botToken = localStorage.getItem('qp_telegram_bot_token');
            const chatId = localStorage.getItem('qp_telegram_chat_id');
            const notifyTsl = localStorage.getItem('qp_notify_tsl') !== 'false';
            if (botToken && chatId && notifyTsl) {
              const lockedPnl = +((nextPos.activeTrailingSl - pos.entryPrice) * pos.quantity).toFixed(2);
              const tslMsg = formatTslAlert(
                pos.symbol,
                nextPos.stateIndex,
                nextPos.stateLabel,
                nextPos.activeTrailingSl,
                lockedPnl,
                timeStr
              );
              fetch('/api/alerts/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botToken, chatId, message: tslMsg }),
              }).catch(() => {});
            }
          }
        }
        return nextPos;
      })
    );
  }, [runAutoScan, showToast, markSelfUpdating]);

  const fetchLiveDhanQuotes = useCallback(
    async (isManualTrigger = false): Promise<boolean> => {
      const res = await requestQueueEngine.executeBatchExclusive(async () => {
        const startTime = Date.now();
        try {
          setIsLiveFetching(true);
          const clientId = typeof window !== 'undefined' ? localStorage.getItem('qp_dhan_client_id') || '' : '';
          const accessToken = typeof window !== 'undefined' ? localStorage.getItem('qp_dhan_access_token') || '' : '';

          const tickers = (watchlistRef.current.length > 0 ? watchlistRef.current : watchlist).map((s) => s.ticker);
          const res = await fetch('/api/broker/dhan/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickers, clientId, accessToken }),
          });

        const data = await res.json();
        const latencyMs = Date.now() - startTime;

        if (!data.success || !data.quotes) {
          setIngestionTelemetry((prev) => ({
            ...prev,
            errorCount: prev.errorCount + 1,
            lastLatencyMs: latencyMs,
          }));
          if (!data.isConfigured) {
            if (isManualTrigger) {
              showToast('Dhan credentials not configured. Open "🔌 Broker: Dhan HQ" to configure keys.', 'amber');
            }
          } else {
            showToast(`Dhan Feed: ${data.message}`, 'rose');
          }
          return false;
        }

        const quotesMap = data.quotes;
        const nowTime = formatClockIST(clockSecondsRef.current);
        const sessionStarted = hasTodayMarketSessionStarted();

        setWatchlist((prevWl) => {
          const updatedWl = prevWl.map((stock) => {
            const q = quotesMap[stock.ticker];
            if (!q) return stock;

            // Before 09:15 IST on trading days or on weekends, today's regular session has not traded.
            // Today's traded volume must remain 0.00M, and crossover cannot trigger!
            const safeTodayVol = sessionStarted
              ? (q.volumeM !== undefined ? Number(q.volumeM) : stock.todayVolM)
              : 0.0;

            const updated: Stock = {
              ...stock,
              spotLtp: q.ltp || stock.spotLtp,
              todayVolM: safeTodayVol,
              dayHigh: sessionStarted ? (q.high || stock.dayHigh) : (q.ltp || stock.spotLtp),
              dayLow: sessionStarted ? (q.low || stock.dayLow) : (q.ltp || stock.spotLtp),
              dayOpen: sessionStarted ? (q.open || stock.dayOpen) : (q.ltp || stock.spotLtp),
              dayClose: q.close || stock.dayClose,
              changePct: q.changePct !== undefined ? q.changePct : stock.changePct,
              feedSource: 'LIVE_DHAN',
              hasCrossed20D: sessionStarted ? stock.hasCrossed20D : false,
              crossoverTime: sessionStarted ? stock.crossoverTime : null,
              crossoverSpotPrice: sessionStarted ? stock.crossoverSpotPrice : null,
            };

            if (sessionStarted && safeTodayVol > 0) {
              const { newlyCrossed, event } = checkAndLatchVolumeCrossover(updated, nowTime);
              if (newlyCrossed && event) {
                setCrossoverEvents((prevEv) => {
                  if (prevEv.some((e) => e.ticker === event.ticker)) {
                    return prevEv;
                  }
                  return [event, ...prevEv];
                });
                showToast(
                  `🚀 [LIVE MARKET] ${stock.ticker} Crossed 20D Volume (${stock.avgVol20DM.toFixed(2)}M) @ ₹${updated.spotLtp.toFixed(2)}!`,
                  'emerald'
                );

                if (isSupabaseConfigured && supabase) {
                  markSelfUpdating();
                  const client = supabase;
                  const todayStr = getISTDate().dateStr;
                  client
                    .from('crossover_events')
                    .select('id')
                    .eq('ticker', event.ticker)
                    .gte('created_at', `${todayStr}T00:00:00`)
                    .then(({ data: existingRows }) => {
                      if (!existingRows || existingRows.length === 0) {
                        client
                          .from('crossover_events')
                          .insert({
                            ticker: event.ticker,
                            time_ist: event.time,
                            avg_vol_20d_m: event.avgVol20DM,
                            cross_price: event.crossPrice,
                            is_fno: event.isFnO,
                          })
                          .then();
                      }
                    });

                  client
                    .from('watchlist')
                    .update({
                      has_crossed_20d: true,
                      crossover_time: event.time,
                      crossover_spot_price: event.crossPrice,
                      spot_ltp: updated.spotLtp,
                      today_vol_m: updated.todayVolM,
                      day_high: updated.dayHigh,
                      day_low: updated.dayLow,
                      day_open: updated.dayOpen,
                      day_close: updated.dayClose,
                      change_pct: updated.changePct,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('ticker', event.ticker)
                    .then();
                }

                // Telegram push
                if (typeof window !== 'undefined') {
                  const botToken = localStorage.getItem('qp_telegram_bot_token');
                  const chatId = localStorage.getItem('qp_telegram_chat_id');
                  const notifyCross = localStorage.getItem('qp_notify_crossover') !== 'false';
                  if (botToken && chatId && notifyCross) {
                    fetch('/api/alerts/telegram', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        botToken,
                        chatId,
                        message: `🚀 *QUANTPULSE 20D CROSSOVER (LIVE FEED)!*\nSymbol: \`${stock.ticker}\`\nTime: \`${nowTime} IST\`\nToday Vol: \`${updated.todayVolM.toFixed(2)}M\` (vs 20D: \`${stock.avgVol20DM.toFixed(2)}M\`)\nSpot Price: \`₹${updated.spotLtp.toFixed(2)}\`\nStatus: 🟢 *ELIGIBLE FOR BUY*`,
                      }),
                    }).catch(() => {});
                  }
                }
              }
            }

            return updated;
          });

          // Run auto-mode scan only if regular market has opened today
          if (sessionStarted) {
            runAutoScan(updatedWl, idempotencyLocksRef.current, positionsRef.current);
          }
          return updatedWl;
        });

        // Update active positions with live market LTP
        setPositions((prevPos) =>
          prevPos.map((pos) => {
            const q = quotesMap[pos.ticker];
            if (!q) return pos;

            let updatedLtp = pos.currentLtp;
            if (pos.instrumentType === 'STOCK') {
              updatedLtp = q.ltp;
            } else {
              // Option delta move approximation: Spot movement * 0.50 ATM Delta
              const spotChange = q.ltp - pos.entryPrice;
              updatedLtp = Math.max(0.5, +(pos.entryPrice + spotChange * 0.5).toFixed(2));
            }

            const updatedPos = { ...pos, currentLtp: updatedLtp };
            const nextPos = autoUpdatePositionFromTick(updatedPos);

            if (nextPos.stateIndex !== pos.stateIndex) {
              logTslTransitionToCloud({
                position_id: pos.id,
                symbol: pos.symbol,
                from_state: pos.stateIndex,
                to_state: nextPos.stateIndex,
                from_label: pos.stateLabel,
                to_label: nextPos.stateLabel,
                spot_price_at_transition: nextPos.currentLtp,
                new_trailing_sl: nextPos.activeTrailingSl,
                pnl_locked: (nextPos.activeTrailingSl - pos.entryPrice) * pos.quantity,
                timestamp_ist: new Date().toLocaleTimeString('en-IN'),
              });

              if (nextPos.stateIndex === 4) {
                const finalPnl = (nextPos.currentLtp - pos.entryPrice) * pos.quantity;
                closeTradeOrderInCloud(pos.id, nextPos.currentLtp, finalPnl);
              }

              if (isSupabaseConfigured && supabase) {
                markSelfUpdating();
                const client = supabase;
                client
                  .from('active_positions')
                  .update({
                    current_ltp: nextPos.currentLtp,
                    active_trailing_sl: nextPos.activeTrailingSl,
                    state_index: nextPos.stateIndex,
                    state_label: nextPos.stateLabel,
                  })
                  .eq('id', pos.id)
                  .then();
              }

              // Automated Telegram alert for live real-time TSL progression (+1R, +2R, +3R/Exit)
              if (typeof window !== 'undefined') {
                const botToken = localStorage.getItem('qp_telegram_bot_token');
                const chatId = localStorage.getItem('qp_telegram_chat_id');
                const notifyTsl = localStorage.getItem('qp_notify_tsl') !== 'false';
                if (botToken && chatId && notifyTsl) {
                  const lockedPnl = +((nextPos.activeTrailingSl - pos.entryPrice) * pos.quantity).toFixed(2);
                  const nowIST = getISTDate().timeStr;
                  const tslMsg = formatTslAlert(
                    pos.symbol,
                    nextPos.stateIndex,
                    nextPos.stateLabel,
                    nextPos.activeTrailingSl,
                    lockedPnl,
                    nowIST
                  );
                  fetch('/api/alerts/telegram', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ botToken, chatId, message: tslMsg }),
                  }).catch(() => {});
                }
              }
            }
            return nextPos;
          })
        );

        const syncTime = new Date().toLocaleTimeString('en-IN');
        setLastLiveSyncTime(syncTime);
        packetCountRef.current += 1;

        setIngestionTelemetry((prev) => ({
          packetsReceived: prev.packetsReceived + 1,
          lastLatencyMs: latencyMs,
          lastSyncTimestamp: syncTime,
          errorCount: 0,
          streamActive: isLiveStreamingRef.current,
          pulseIntervalMs: marketSessionRef.current.recommendedIntervalMs,
        }));

        // Periodic cloud snapshot logging (every 10 packets to optimize DB writes)
        if (packetCountRef.current % 10 === 0 && isSupabaseConfigured && supabase) {
          const currentWl = watchlistRef.current || [];
          const snapshots = Object.entries(quotesMap).map(([ticker, q]: [string, any]) => {
            const stock = currentWl.find((s) => s.ticker === ticker);
            const avgVol = stock?.avgVol20DM || 1.0;
            const vol = sessionStarted ? (q.volumeM !== undefined ? Number(q.volumeM) : 0) : 0;
            return {
              ticker,
              timestamp_ist: nowTime,
              spot_ltp: Number(q.ltp) || 0,
              today_vol_m: vol,
              avg_vol_20d_m: avgVol,
              rvol_ratio: avgVol > 0 ? +(vol / avgVol).toFixed(2) : 1.0,
            };
          });
          logBatchTickSnapshotsToCloud(snapshots).catch(() => {});
        }

        // Periodic sync of live quotes to public.watchlist in Supabase (every 5 packets)
        if (packetCountRef.current % 5 === 0 && isSupabaseConfigured && supabase) {
          markSelfUpdating();
          const client = supabase;
          Object.entries(quotesMap).forEach(([ticker, q]: [string, any]) => {
            const vol = sessionStarted ? (q.volumeM !== undefined ? Number(q.volumeM) : 0) : 0;
            client
              .from('watchlist')
              .update({
                spot_ltp: Number(q.ltp) || 0,
                today_vol_m: vol,
                day_high: q.high ? Number(q.high) : undefined,
                day_low: q.low ? Number(q.low) : undefined,
                day_open: q.open ? Number(q.open) : undefined,
                day_close: q.close ? Number(q.close) : undefined,
                change_pct: q.changePct !== undefined ? Number(q.changePct) : 0,
                updated_at: new Date().toISOString(),
              })
              .eq('ticker', ticker)
              .then();
          });
        }

        if (isManualTrigger) {
          showToast(
            `✅ Live market quotes refreshed for ${Object.keys(quotesMap).length} symbols (${syncTime} IST)`,
            'emerald'
          );
        }
        return true;
      } catch (err: any) {
        setIngestionTelemetry((prev) => ({
          ...prev,
          errorCount: prev.errorCount + 1,
        }));
        if (isManualTrigger) {
          showToast(`Live Quote Error: ${err.message}`, 'rose');
        }
        return false;
      } finally {
        setIsLiveFetching(false);
      }
    });

    return res ?? false;
  },
  [runAutoScan, showToast, markSelfUpdating]
);

  const refreshLiveQuotesNow = useCallback(async () => {
    await fetchLiveDhanQuotes(true);
  }, [fetchLiveDhanQuotes]);

  const resetToDayStart = useCallback(async () => {
    await syncDailyBaselines(true, true);
    // If continuous trading has already started today, initialize Traded Shares with today's live feed
    if (hasTodayMarketSessionStarted()) {
      await fetchLiveDhanQuotes(true);
    }
    showToast('🔄 Watchlist initialized for Day Start (Traded Shares set to today\'s session).', 'info');
  }, [syncDailyBaselines, fetchLiveDhanQuotes, showToast]);

  const executeAutoPilotStep = useCallback(
    async (stepId: AutoPilotStepId) => {
      if (runningAutoPilotStepRef.current) return;
      runningAutoPilotStepRef.current = stepId;
      const ist = getISTDate();

      try {
        if (stepId === 'STEP_1_SYNC_20D') {
          showToast('🤖 Auto-Pilot: Step 1 (09:00 AM) — 20D Baseline Sync starting...', 'info');
          await syncDailyBaselines(false, true);
          saveStepCompleted('STEP_1_SYNC_20D', ist.timeStr, ist.dateStr);
          showToast('✅ Step 1 Done: 20D Baselines synced for today.', 'emerald');

          if (typeof window !== 'undefined') {
            const botToken = localStorage.getItem('qp_telegram_bot_token');
            const chatId = localStorage.getItem('qp_telegram_chat_id');
            if (botToken && chatId) {
              const msg = formatAutoPilotAlert(1, '20D Baseline Sync', 'Calculated 20-Day historical volume benchmarks for all focus stocks.', ist.timeStr);
              sendTelegramMessage(botToken, chatId, msg).catch(() => {});
            }
          }
        } else if (stepId === 'STEP_2_DAY_START') {
          showToast('🤖 Auto-Pilot: Step 2 (09:00 AM) — Day Start Session Reset starting...', 'info');
          await resetToDayStart();
          saveStepCompleted('STEP_2_DAY_START', ist.timeStr, ist.dateStr);
          showToast('✅ Step 2 Done: Day Start Initialized (0.00M volume reset).', 'emerald');

          if (typeof window !== 'undefined') {
            const botToken = localStorage.getItem('qp_telegram_bot_token');
            const chatId = localStorage.getItem('qp_telegram_chat_id');
            if (botToken && chatId) {
              const msg = formatAutoPilotAlert(2, 'Day Start Session Reset', 'Today traded volume zeroed. Cleared prior crossover event flags.', ist.timeStr);
              sendTelegramMessage(botToken, chatId, msg).catch(() => {});
            }
          }
        } else if (stepId === 'STEP_3_LIVE_SYNC') {
          showToast('🤖 Auto-Pilot: Step 3 (09:07 AM) — Pre-Open Discovered Quotes Sync...', 'info');
          await fetchLiveDhanQuotes(true);
          saveStepCompleted('STEP_3_LIVE_SYNC', ist.timeStr, ist.dateStr);
          showToast('✅ Step 3 Done: Discovered pre-open prices synced & Option strikes calibrated.', 'emerald');

          if (typeof window !== 'undefined') {
            const botToken = localStorage.getItem('qp_telegram_bot_token');
            const chatId = localStorage.getItem('qp_telegram_chat_id');
            if (botToken && chatId) {
              const msg = formatAutoPilotAlert(3, 'Pre-Open Live Sync', 'NSE pre-open discovered opening prices synced. ATM Option strikes calibrated.', ist.timeStr);
              sendTelegramMessage(botToken, chatId, msg).catch(() => {});
            }
          }
        } else if (stepId === 'STEP_4_START_FEED') {
          showToast('🤖 Auto-Pilot: Step 4 (09:14 AM) — Starting Live Feed ahead of Opening Bell...', 'emerald');
          setFeedModeState('DHAN_LIVE');
          setIsLiveStreaming(true);
          saveStepCompleted('STEP_4_START_FEED', ist.timeStr, ist.dateStr);
          showToast('🟢 Step 4 Done: Live Feed Connected! Ready for 09:15 Opening Bell.', 'emerald');

          if (typeof window !== 'undefined') {
            const botToken = localStorage.getItem('qp_telegram_bot_token');
            const chatId = localStorage.getItem('qp_telegram_chat_id');
            if (botToken && chatId) {
              const msg = formatAutoPilotAlert(4, 'Start Live Feed', 'Live quote & tick ingestion active. Armed for 09:15 opening bell!', ist.timeStr);
              sendTelegramMessage(botToken, chatId, msg).catch(() => {});
            }
          }
        }
      } catch (err: any) {
        console.error(`Auto-Pilot ${stepId} error:`, err);
        showToast(`⚠️ Auto-Pilot ${stepId} error: ${err.message || 'Unknown error'}`, 'rose');
      } finally {
        runningAutoPilotStepRef.current = null;
        const istNow = getISTDate();
        const secs = istNow.hours * 3600 + istNow.minutes * 60 + istNow.seconds;
        setAutoPilotStatus(evaluateAutoPilot(secs, isLiveStreamingRef.current, null).status);
      }
    },
    [syncDailyBaselines, resetToDayStart, fetchLiveDhanQuotes, showToast]
  );

  useEffect(() => {
    executeAutoPilotStepRef.current = executeAutoPilotStep;
  }, [executeAutoPilotStep]);

  const toggleAutoPilot = useCallback(() => {
    setAutoPilotStatus((prev) => {
      const nextEnabled = !prev.enabled;
      setStoredAutoPilotEnabled(nextEnabled);
      showToast(
        nextEnabled
          ? '🤖 Pre-Market Auto-Pilot ACTIVATED (09:00 -> 09:01 -> 09:07 -> 09:14)'
          : '⏸️ Pre-Market Auto-Pilot PAUSED (Manual Execution Mode)',
        nextEnabled ? 'emerald' : 'amber'
      );
      const ist = getISTDate();
      const secs = ist.hours * 3600 + ist.minutes * 60 + ist.seconds;
      return evaluateAutoPilot(secs, isLiveStreamingRef.current, runningAutoPilotStepRef.current).status;
    });
  }, [showToast]);

  const runAutoPilotStepNow = useCallback(
    async (stepId: AutoPilotStepId) => {
      await executeAutoPilotStep(stepId);
    },
    [executeAutoPilotStep]
  );

  const toggleLiveStream = useCallback(() => {
    setIsLiveStreaming((prev) => {
      const next = !prev;
      setIngestionTelemetry((t) => ({ ...t, streamActive: next }));
      if (next) {
        const intervalSec = (marketSession.recommendedIntervalMs / 1000).toFixed(1);
        showToast(
          feedMode === 'DHAN_LIVE'
            ? `🟢 Live Dhan Ingestion Active (${intervalSec}s pulse • ${marketSession.statusLabel})`
            : '⚡ Demo Simulation Stream running — Watching 20D crossovers!',
          'emerald'
        );
      } else {
        showToast('Live stream paused.', 'amber');
      }
      return next;
    });
  }, [feedMode, marketSession, showToast]);

  useEffect(() => {
    if (!isLiveStreaming) {
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      }
      return;
    }

    if (feedMode === 'DHAN_LIVE') {
      fetchLiveDhanQuotes();
      const intervalMs = marketSession.recommendedIntervalMs || 2000;
      streamTimerRef.current = setInterval(() => {
        fetchLiveDhanQuotes();
      }, intervalMs);
    } else {
      streamTimerRef.current = setInterval(() => {
        simulateSingleTick();
      }, 1500);
    }

    return () => {
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      }
    };
  }, [isLiveStreaming, feedMode, fetchLiveDhanQuotes, simulateSingleTick, marketSession.recommendedIntervalMs]);

  const forceCrossover = useCallback(
    (tickerSymbol: string) => {
      setSelectedTicker(tickerSymbol);
      const timeStr = getISTDate().timeStr;

      setWatchlist((prevWl) => {
        return prevWl.map((stock) => {
          if (stock.ticker !== tickerSymbol) return stock;
          if (!stock.hasCrossed20D) {
            const newSpot = +(stock.spotLtp * 1.008).toFixed(2);
            const dayOpen = stock.dayOpen || stock.spotLtp;
            const newChangePct = +(((newSpot - dayOpen) / dayOpen) * 100).toFixed(2);
            const updated = {
              ...stock,
              todayVolM: +(stock.avgVol20DM * 1.035).toFixed(2),
              spotLtp: newSpot,
              changePct: newChangePct,
            };
            const { newlyCrossed, event } = checkAndLatchVolumeCrossover(updated, timeStr);
            if (newlyCrossed && event) {
              setCrossoverEvents((prevEv) => {
                if (prevEv.some((e) => e.ticker === event.ticker)) {
                  return prevEv;
                }
                return [event, ...prevEv];
              });
              showToast(
                `⏱️ [${timeStr}] ${stock.ticker} crossed 20D Avg Vol (${stock.avgVol20DM.toFixed(2)}M) @ ₹${updated.spotLtp.toFixed(2)}!`,
                'emerald'
              );

              if (isSupabaseConfigured && supabase) {
                markSelfUpdating();
                const client = supabase;
                const todayStr = getISTDate().dateStr;
                client
                  .from('crossover_events')
                  .select('id')
                  .eq('ticker', event.ticker)
                  .gte('created_at', `${todayStr}T00:00:00`)
                  .then(({ data: existingRows }) => {
                    if (!existingRows || existingRows.length === 0) {
                      client.from('crossover_events').insert({
                        ticker: event.ticker,
                        time_ist: event.time,
                        avg_vol_20d_m: event.avgVol20DM,
                        cross_price: event.crossPrice,
                        is_fno: event.isFnO,
                      }).then();
                    }
                  });

                client.from('watchlist').update({
                  has_crossed_20d: true,
                  crossover_time: event.time,
                  crossover_spot_price: event.crossPrice,
                  spot_ltp: updated.spotLtp,
                  today_vol_m: updated.todayVolM,
                  change_pct: updated.changePct,
                  updated_at: new Date().toISOString(),
                }).eq('ticker', event.ticker).then();
              }
            }
            return updated;
          } else {
            showToast(`${stock.ticker} already crossed at ${stock.crossoverTime} IST.`, 'info');
            return {
              ...stock,
              todayVolM: +(stock.todayVolM + stock.avgVol20DM * 0.05).toFixed(2),
            };
          }
        });
      });

      if (config.executionMode === 'AUTO') {
        setTimeout(() => {
          executeBuy(tickerSymbol, 'AUTO');
        }, 100);
      }
    },
    [config.executionMode, executeBuy, showToast]
  );

  const panicKillSwitch = useCallback(() => {
    setConfig((prev) => ({ ...prev, executionMode: 'MANUAL' }));
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
      setIsLiveStreaming(false);
    }
    let closed = 0;
    setPositions((prev) =>
      prev.map((p) => {
        if (p.stateIndex < 4) {
          closed++;
          const finalPnl = (p.currentLtp - p.entryPrice) * p.quantity;
          closeTradeOrderInCloud(p.id, p.currentLtp, finalPnl);
          if (isSupabaseConfigured && supabase) {
            const client = supabase;
            client
              .from('active_positions')
              .update({
                state_index: 4,
                state_label: 'State 4: Kill-Switch Square Off',
              })
              .eq('id', p.id)
              .then();
          }
          return {
            ...p,
            stateIndex: 4,
            stateLabel: 'State 4: Kill-Switch Square Off',
          };
        }
        return p;
      })
    );
    showToast(`🛑 KILL-SWITCH: Auto Trade OFF. Squared off ${closed} open trade(s).`, 'rose');
  }, [showToast]);

  const advancePositionState = useCallback(
    (posId: string, milestone: TslMilestone) => {
      const nowTime = formatClockIST(clockSeconds);
      setPositions((prev) =>
        prev.map((pos) => {
          if (pos.id !== posId) return pos;
          const updated = advancePositionMilestone(pos, milestone);
          if (milestone === 'PLUS_1R') {
            showToast(`${pos.symbol} hit +1R! Trailing SL moved to Breakeven (₹${updated.activeTrailingSl})`, 'info');
          } else if (milestone === 'PLUS_2R') {
            showToast(`${pos.symbol} hit +2R! Trailing SL locked +1R profit (₹${updated.activeTrailingSl})`, 'emerald');
          } else if (milestone === 'EXIT') {
            showToast(`Closed ${pos.symbol} @ ₹${updated.currentLtp.toFixed(2)}`, 'amber');
          }

          // Telemetry audit logging to Supabase
          logTslTransitionToCloud({
            position_id: pos.id,
            symbol: pos.symbol,
            from_state: pos.stateIndex,
            to_state: updated.stateIndex,
            from_label: pos.stateLabel,
            to_label: updated.stateLabel,
            spot_price_at_transition: updated.currentLtp,
            new_trailing_sl: updated.activeTrailingSl,
            pnl_locked: (updated.activeTrailingSl - pos.entryPrice) * pos.quantity,
            timestamp_ist: nowTime,
          });

          if (updated.stateIndex === 4) {
            const finalPnl = (updated.currentLtp - pos.entryPrice) * pos.quantity;
            closeTradeOrderInCloud(pos.id, updated.currentLtp, finalPnl);
          }

          if (isSupabaseConfigured && supabase) {
            markSelfUpdating();
            const client = supabase;
            client
              .from('active_positions')
              .update({
                current_ltp: updated.currentLtp,
                active_trailing_sl: updated.activeTrailingSl,
                state_index: updated.stateIndex,
                state_label: updated.stateLabel,
              })
              .eq('id', pos.id)
              .then();
          }

          // Automated Telegram alert for manual / simulated TSL milestone progression
          if (typeof window !== 'undefined') {
            const botToken = localStorage.getItem('qp_telegram_bot_token');
            const chatId = localStorage.getItem('qp_telegram_chat_id');
            const notifyTsl = localStorage.getItem('qp_notify_tsl') !== 'false';
            if (botToken && chatId && notifyTsl) {
              const lockedPnl = +((updated.activeTrailingSl - pos.entryPrice) * pos.quantity).toFixed(2);
              const tslMsg = formatTslAlert(
                pos.symbol,
                updated.stateIndex,
                updated.stateLabel,
                updated.activeTrailingSl,
                lockedPnl,
                nowTime
              );
              fetch('/api/alerts/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botToken, chatId, message: tslMsg }),
              }).catch(() => {});
            }
          }

          return updated;
        })
      );
    },
    [clockSeconds, showToast]
  );

  const addCustomStock = useCallback(
    (stockData: Omit<Stock, 'hasCrossed20D' | 'crossoverTime' | 'crossoverSpotPrice'>) => {
      const meta = resolveStockMetadata(stockData);
      const nowStr = formatClockIST(clockSeconds);
      const targetAvg = stockData.avgVol20DM || meta.avgVol20DM;
      const alreadyCrossed = stockData.todayVolM >= targetAvg;

      const newStock: Stock = {
        ...stockData,
        ticker: meta.ticker,
        shortName: meta.shortName,
        name: meta.name,
        isin: meta.isin,
        isFnO: meta.isFnO,
        segment: meta.segment,
        sector: meta.sector,
        securityId: meta.securityId,
        lotSize: meta.lotSize,
        strikeStep: meta.strikeStep,
        avgVol20DM: targetAvg,
        indices: meta.indices,
        hasCrossed20D: alreadyCrossed,
        crossoverTime: alreadyCrossed ? nowStr : null,
        crossoverSpotPrice: alreadyCrossed ? stockData.spotLtp : null,
        justCrossedHighlight: alreadyCrossed,
      };

      if (alreadyCrossed) {
        setCrossoverEvents((prev) => {
          if (prev.some((e) => normalizeTicker(e.ticker) === meta.ticker)) {
            return prev;
          }
          return [
            {
              ticker: newStock.ticker,
              time: nowStr,
              avgVol20DM: newStock.avgVol20DM,
              crossPrice: newStock.spotLtp,
              isFnO: newStock.isFnO,
            },
            ...prev,
          ];
        });
      }

      setWatchlist((prev) => {
        const filtered = prev.filter((s) => normalizeTicker(s.ticker) !== meta.ticker);
        const updated = [newStock, ...filtered];
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'qp_active_watchlist_tickers',
            JSON.stringify(updated.map((s) => s.ticker))
          );
        }
        return updated;
      });

      if (isSupabaseConfigured && supabase) {
        markSelfUpdating();
        const client = supabase;
        client
          .from('watchlist')
          .upsert({
            ticker: newStock.ticker,
            short_name: newStock.shortName,
            name: newStock.name,
            isin: newStock.isin,
            is_fno: newStock.isFnO,
            segment: newStock.segment,
            sector: newStock.sector,
            security_id: newStock.securityId,
            lot_size: newStock.lotSize,
            strike_step: newStock.strikeStep,
            spot_ltp: newStock.spotLtp,
            today_vol_m: newStock.todayVolM,
            avg_vol_20d_m: newStock.avgVol20DM,
            has_crossed_20d: alreadyCrossed,
            crossover_time: newStock.crossoverTime,
            crossover_spot_price: newStock.crossoverSpotPrice,
            is_active_watchlist: true,
            updated_at: new Date().toISOString(),
          })
          .then();
      }

      setSelectedTicker(newStock.ticker);
      showToast(
        alreadyCrossed
          ? `Added ${newStock.ticker} (${newStock.shortName}) — Already above 20D Avg Vol! Latched at ${nowStr}.`
          : `Added ${newStock.ticker} (${newStock.shortName}) — Monitoring Today Vol vs 20D Avg.`,
        alreadyCrossed ? 'emerald' : 'info'
      );
    },
    [clockSeconds, markSelfUpdating, showToast]
  );

  const addStockFromMaster = useCallback(
    (master: StockMasterItem) => {
      setWatchlist((prev) => {
        const cleanTicker = normalizeTicker(master.ticker);
        if (prev.some((s) => normalizeTicker(s.ticker) === cleanTicker)) {
          showToast(`${cleanTicker} is already in the active Watchlist.`, 'info');
          return prev;
        }
        const newStock: Stock = convertMasterToStock(master);
        const updated = [...prev, newStock];

        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'qp_active_watchlist_tickers',
            JSON.stringify(updated.map((s) => s.ticker))
          );
        }

        if (isSupabaseConfigured && supabase) {
          markSelfUpdating();
          const client = supabase;
          // 1. Update status flag in stock_master directory table
          client
            .from('stock_master')
            .update({ is_active_watchlist: true, updated_at: new Date().toISOString() })
            .eq('ticker', master.ticker)
            .then();

          // 2. Upsert into active watchlist table
          client
            .from('watchlist')
            .upsert({
              ticker: newStock.ticker,
              short_name: newStock.shortName,
              name: newStock.name,
              isin: newStock.isin,
              is_fno: newStock.isFnO,
              segment: newStock.segment,
              sector: newStock.sector,
              security_id: newStock.securityId,
              lot_size: newStock.lotSize,
              strike_step: newStock.strikeStep,
              spot_ltp: newStock.spotLtp,
              today_vol_m: newStock.todayVolM,
              avg_vol_20d_m: newStock.avgVol20DM,
              has_crossed_20d: false,
              is_active_watchlist: true,
              updated_at: new Date().toISOString(),
            })
            .then();
        }

        setSelectedTicker(master.ticker);
        showToast(`✅ Added ${master.ticker} (${master.name}) to Active Watchlist!`, 'emerald');
        return updated;
      });
    },
    [markSelfUpdating, showToast]
  );

  const removeStockFromWatchlist = useCallback(
    (ticker: string) => {
      setWatchlist((prev) => {
        if (prev.length <= 1) {
          showToast('Cannot remove the last stock from watchlist.', 'amber');
          return prev;
        }
        const updated = prev.filter((s) => s.ticker !== ticker);
        if (selectedTicker === ticker) {
          setSelectedTicker(updated[0].ticker);
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'qp_active_watchlist_tickers',
            JSON.stringify(updated.map((s) => s.ticker))
          );
        }

        if (isSupabaseConfigured && supabase) {
          markSelfUpdating();
          const client = supabase;
          // 1. Update status flag in stock_master directory table
          client
            .from('stock_master')
            .update({ is_active_watchlist: false, updated_at: new Date().toISOString() })
            .eq('ticker', ticker)
            .then();

          // 2. Delete from active watchlist table
          client.from('watchlist').delete().eq('ticker', ticker).then();
        }
        showToast(`Removed ${ticker} from Active Watchlist.`, 'info');
        return updated;
      });
    },
    [selectedTicker, markSelfUpdating, showToast]
  );

  const resetSimulation = useCallback(() => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
      setIsLiveStreaming(false);
    }
    setClockSeconds(getNowIstSeconds());
    setWatchlist(JSON.parse(JSON.stringify(INITIAL_WATCHLIST_DATA)));
    setCrossoverEvents(JSON.parse(JSON.stringify(INITIAL_CROSSOVER_LOGS)));
    setIdempotencyLocks([]);
    setSelectedTicker('TCS');
    showToast('Simulation reset! Ready to test 20D crossover latching.', 'info');
  }, [showToast]);

  const totalMtmPnl = positions.reduce((acc, pos) => {
    const unitPnl = pos.currentLtp - pos.entryPrice;
    return acc + unitPnl * pos.quantity;
  }, 0);

  return (
    <QuantPulseContext.Provider
      value={{
        watchlist,
        crossoverEvents,
        positions,
        config,
        selectedTicker,
        clockTime,
        currentTradingDate,
        isBaselineSyncing,
        isLiveStreaming,
        toasts,
        isJsonModalOpen,
        isAddStockModalOpen,
        isBrokerModalOpen,
        isOptionChainModalOpen,
        isAlertsModalOpen,
        isAuthModalOpen,
        isCloudLogsModalOpen,
        idempotencyLocks,
        totalMtmPnl,
        isSupabaseActive: isSupabaseConfigured,
        setSelectedTicker,
        setInstrumentMode: (mode) => setConfig((prev) => ({ ...prev, instrumentMode: mode })),
        setExecutionMode: (mode) => setConfig((prev) => ({ ...prev, executionMode: mode })),
        setCapitalPerTrade: (val) => setConfig((prev) => ({ ...prev, capitalPerTrade: val })),
        syncDailyBaselines,
        resetToDayStart,
        clearCrossoverEvents,
        forceCrossover,
        executeBuy,
        panicKillSwitch,
        advancePositionState,
        addCustomStock,
        addStockFromMaster,
        removeStockFromWatchlist,
        toggleLiveStream,
        simulateSingleTick,
        resetSimulation,
        feedMode,
        setFeedMode,
        lastLiveSyncTime,
        isLiveFetching,
        fetchLiveDhanQuotes,
        refreshLiveQuotesNow,
        setIsJsonModalOpen,
        setIsAddStockModalOpen,
        setIsBrokerModalOpen,
        setIsOptionChainModalOpen,
        setIsAlertsModalOpen,
        setIsAuthModalOpen,
        setIsCloudLogsModalOpen,
        removeToast,
        showToast,
        brokerVaultStatus,
        refreshBrokerVaultStatus,
        marketSession,
        ingestionTelemetry,
        autoPilotStatus,
        isAutoPilotModalOpen,
        setIsAutoPilotModalOpen,
        toggleAutoPilot,
        runAutoPilotStepNow,
      }}
    >
      {children}
    </QuantPulseContext.Provider>
  );
}

export function useQuantPulse() {
  const context = useContext(QuantPulseContext);
  if (!context) {
    throw new Error('useQuantPulse must be used within a QuantPulseProvider');
  }
  return context;
}
