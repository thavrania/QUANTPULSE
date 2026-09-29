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
} from '@/lib/types/quant';
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
import { MarketSessionInfo, getIndianMarketSession } from '@/lib/services/marketHoursService';
import { IngestionTelemetry } from '@/lib/services/liveIngestionEngine';
import { requestQueueEngine } from '@/lib/engine/requestQueueEngine';

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
  forceCrossover: (ticker: string) => void;
  executeBuy: (ticker: string, triggeredBy?: ExecutionMode) => void;
  panicKillSwitch: () => void;
  advancePositionState: (posId: string, milestone: TslMilestone) => void;
  addCustomStock: (stock: Omit<Stock, 'hasCrossed20D' | 'crossoverTime' | 'crossoverSpotPrice'>) => void;
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
}

const QuantPulseContext = createContext<QuantPulseContextType | undefined>(undefined);

export function QuantPulseProvider({ children }: { children: React.ReactNode }) {
  const [watchlist, setWatchlist] = useState<Stock[]>(INITIAL_WATCHLIST_DATA);
  const [crossoverEvents, setCrossoverEvents] = useState<CrossoverEvent[]>(INITIAL_CROSSOVER_LOGS);
  const [positions, setPositions] = useState<Position[]>([]);
  const [config, setConfig] = useState<SystemConfig>({
    instrumentMode: 'STOCK',
    executionMode: 'MANUAL',
    capitalPerTrade: 100000,
    maxOpenPositions: 5,
  });
  const [selectedTicker, setSelectedTicker] = useState<string>('RELIANCE');
  const [clockSeconds, setClockSeconds] = useState<number>(38530); // 10:42:10 IST
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

  const packetCountRef = useRef<number>(0);
  const streamTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep Indian Market Session updated every second
  useEffect(() => {
    const timer = setInterval(() => {
      setMarketSession(getIndianMarketSession());
    }, 1000);
    return () => clearInterval(timer);
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

  const clockTime = formatClockIST(clockSeconds);

  // 1. Clock increment timer
  useEffect(() => {
    const timer = setInterval(() => {
      setClockSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Fetch from Supabase if configured
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    async function loadFromSupabase() {
      try {
        const { data: wlData } = await supabase!.from('watchlist').select('*');
        if (wlData && wlData.length > 0) {
          const mapped: Stock[] = wlData.map((d: any) => ({
            ticker: d.ticker,
            name: d.name,
            isFnO: d.is_fno,
            lotSize: d.lot_size,
            strikeStep: d.strike_step,
            spotLtp: Number(d.spot_ltp),
            todayVolM: Number(d.today_vol_m),
            avgVol20DM: Number(d.avg_vol_20d_m),
            hasCrossed20D: Boolean(d.has_crossed_20d),
            crossoverTime: d.crossover_time,
            crossoverSpotPrice: d.crossover_spot_price ? Number(d.crossover_spot_price) : null,
            ivPct: Number(d.iv_pct || 0),
          }));
          setWatchlist(mapped);
        }

        const { data: evData } = await supabase!.from('crossover_events').select('*').order('created_at', { ascending: false });
        if (evData && evData.length > 0) {
          const mappedEv: CrossoverEvent[] = evData.map((e: any) => ({
            id: e.id,
            ticker: e.ticker,
            time: e.time_ist,
            avgVol20DM: Number(e.avg_vol_20d_m),
            crossPrice: Number(e.cross_price),
            isFnO: Boolean(e.is_fno),
          }));
          setCrossoverEvents(mappedEv);
        }

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

    // Subscribe to realtime changes
    const channel = supabase
      .channel('quantpulse-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watchlist' }, () => {
        loadFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crossover_events' }, () => {
        loadFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_positions' }, () => {
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

      // Persist to Supabase if available
      if (isSupabaseConfigured && supabase) {
        supabase.from('active_positions').insert({
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
          routing_mode: typeof window !== 'undefined' && localStorage.getItem('qp_order_routing_mode') === 'LIVE' ? 'LIVE_DHAN' : 'PAPER',
          quantity: newPos.quantity,
          lots: newPos.lots,
          entry_price: newPos.entryPrice,
          stop_loss: newPos.activeTrailingSl,
          target_price: newPos.targetPrice,
          crossover_ref_time: newPos.crossoverTime,
          status: 'OPEN',
        });
      }

      // Automated Telegram Order Alert
      if (typeof window !== 'undefined') {
        const botToken = localStorage.getItem('qp_telegram_bot_token');
        const chatId = localStorage.getItem('qp_telegram_chat_id');
        const notifyOrder = localStorage.getItem('qp_notify_order') !== 'false';
        if (botToken && chatId && notifyOrder) {
          fetch('/api/alerts/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              botToken,
              chatId,
              message: `⚡ *QUANTPULSE ORDER DISPATCHED!*\n• Instrument: \`${activeLeg.symbol}\`\n• Action: \`${triggeredBy} BUY\`\n• Quantity: \`${activeLeg.quantity} Units\`\n• Entry Price: \`₹${activeLeg.entryPrice.toFixed(2)}\`\n• Order ID: \`${newPos.id}\`\n• Cross Reference: \`${newPos.crossoverTime} IST\``,
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
    setClockSeconds((prev) => prev + 4);
    const timeStr = formatClockIST(clockSeconds + 4);

    setWatchlist((prevWl) => {
      const updatedWl = prevWl.map((stock) => {
        const volStep = +(stock.avgVol20DM * (0.012 + Math.random() * 0.018)).toFixed(3);
        const newTodayVol = +(stock.todayVolM + volStep).toFixed(3);
        const priceDeltaPct = (Math.random() - 0.42) * 0.006;
        const newSpotLtp = Math.max(10, +(stock.spotLtp * (1 + priceDeltaPct)).toFixed(2));

        const updated = {
          ...stock,
          todayVolM: newTodayVol,
          spotLtp: newSpotLtp,
        };

        const { newlyCrossed, event } = checkAndLatchVolumeCrossover(updated, timeStr);
        if (newlyCrossed && event) {
          setCrossoverEvents((prevEv) => [event, ...prevEv]);
          showToast(
            `⏱️ [${timeStr}] ${stock.ticker} crossed 20D Avg Vol (${stock.avgVol20DM.toFixed(2)}M) @ ₹${newSpotLtp.toFixed(2)} → ELIGIBLE FOR BUY!`,
            'emerald'
          );

          if (isSupabaseConfigured && supabase) {
            supabase.from('crossover_events').insert({
              ticker: event.ticker,
              time_ist: event.time,
              avg_vol_20d_m: event.avgVol20DM,
              cross_price: event.crossPrice,
              is_fno: event.isFnO,
            }).then();
            supabase.from('watchlist').update({
              has_crossed_20d: true,
              crossover_time: event.time,
              crossover_spot_price: event.crossPrice,
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
      runAutoScan(updatedWl, idempotencyLocks, positions);
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
            supabase
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
        }
        return nextPos;
      })
    );
  }, [clockSeconds, idempotencyLocks, positions, runAutoScan, showToast]);

  const fetchLiveDhanQuotes = useCallback(
    async (isManualTrigger = false): Promise<boolean> => {
      const res = await requestQueueEngine.executeBatchExclusive(async () => {
        const startTime = Date.now();
        try {
          setIsLiveFetching(true);
          const clientId = typeof window !== 'undefined' ? localStorage.getItem('qp_dhan_client_id') || '' : '';
          const accessToken = typeof window !== 'undefined' ? localStorage.getItem('qp_dhan_access_token') || '' : '';

          const tickers = watchlist.map((s) => s.ticker);
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
        const nowTime = formatClockIST(clockSeconds);

        setWatchlist((prevWl) => {
          const updatedWl = prevWl.map((stock) => {
            const q = quotesMap[stock.ticker];
            if (!q) return stock;

            const updated: Stock = {
              ...stock,
              spotLtp: q.ltp || stock.spotLtp,
              todayVolM: q.volumeM !== undefined ? q.volumeM : stock.todayVolM,
              dayHigh: q.high || stock.dayHigh,
              dayLow: q.low || stock.dayLow,
              dayOpen: q.open || stock.dayOpen,
              dayClose: q.close || stock.dayClose,
              changePct: q.changePct !== undefined ? q.changePct : stock.changePct,
              feedSource: 'LIVE_DHAN',
            };

            const { newlyCrossed, event } = checkAndLatchVolumeCrossover(updated, nowTime);
            if (newlyCrossed && event) {
              setCrossoverEvents((prevEv) => [event, ...prevEv]);
              showToast(
                `🚀 [LIVE MARKET] ${stock.ticker} Crossed 20D Volume (${stock.avgVol20DM.toFixed(2)}M) @ ₹${updated.spotLtp.toFixed(2)}!`,
                'emerald'
              );

              if (isSupabaseConfigured && supabase) {
                supabase
                  .from('crossover_events')
                  .insert({
                    ticker: event.ticker,
                    time_ist: event.time,
                    avg_vol_20d_m: event.avgVol20DM,
                    cross_price: event.crossPrice,
                    is_fno: event.isFnO,
                  })
                  .then();
                supabase
                  .from('watchlist')
                  .update({
                    has_crossed_20d: true,
                    crossover_time: event.time,
                    crossover_spot_price: event.crossPrice,
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

            return updated;
          });

          // Run auto-mode scan
          runAutoScan(updatedWl, idempotencyLocks, positions);
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
                supabase
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
          streamActive: isLiveStreaming,
          pulseIntervalMs: marketSession.recommendedIntervalMs,
        }));

        // Periodic cloud snapshot logging (every 10 packets to optimize DB writes)
        if (packetCountRef.current % 10 === 0 && isSupabaseConfigured && supabase) {
          const snapshots = Object.entries(quotesMap).map(([ticker, q]: [string, any]) => {
            const stock = watchlist.find((s) => s.ticker === ticker);
            const avgVol = stock?.avgVol20DM || 1.0;
            const vol = q.volumeM !== undefined ? Number(q.volumeM) : 0;
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
  [watchlist, clockSeconds, idempotencyLocks, positions, runAutoScan, showToast, isLiveStreaming, marketSession]
);

  const refreshLiveQuotesNow = useCallback(async () => {
    await fetchLiveDhanQuotes(true);
  }, [fetchLiveDhanQuotes]);

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
      const timeStr = formatClockIST(clockSeconds);

      setWatchlist((prevWl) => {
        return prevWl.map((stock) => {
          if (stock.ticker !== tickerSymbol) return stock;
          if (!stock.hasCrossed20D) {
            const updated = {
              ...stock,
              todayVolM: +(stock.avgVol20DM * 1.035).toFixed(2),
              spotLtp: +(stock.spotLtp * 1.008).toFixed(2),
            };
            const { newlyCrossed, event } = checkAndLatchVolumeCrossover(updated, timeStr);
            if (newlyCrossed && event) {
              setCrossoverEvents((prevEv) => [event, ...prevEv]);
              showToast(
                `⏱️ [${timeStr}] ${stock.ticker} crossed 20D Avg Vol (${stock.avgVol20DM.toFixed(2)}M) @ ₹${updated.spotLtp.toFixed(2)}!`,
                'emerald'
              );
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
    [clockSeconds, config.executionMode, executeBuy, showToast]
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
            supabase
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
            supabase
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

          return updated;
        })
      );
    },
    [clockSeconds, showToast]
  );

  const addCustomStock = useCallback(
    (stockData: Omit<Stock, 'hasCrossed20D' | 'crossoverTime' | 'crossoverSpotPrice'>) => {
      const nowStr = formatClockIST(clockSeconds);
      const alreadyCrossed = stockData.todayVolM >= stockData.avgVol20DM;

      const newStock: Stock = {
        ...stockData,
        hasCrossed20D: alreadyCrossed,
        crossoverTime: alreadyCrossed ? nowStr : null,
        crossoverSpotPrice: alreadyCrossed ? stockData.spotLtp : null,
        justCrossedHighlight: alreadyCrossed,
      };

      if (alreadyCrossed) {
        setCrossoverEvents((prev) => [
          {
            ticker: newStock.ticker,
            time: nowStr,
            avgVol20DM: newStock.avgVol20DM,
            crossPrice: newStock.spotLtp,
            isFnO: newStock.isFnO,
          },
          ...prev,
        ]);
      }

      setWatchlist((prev) => {
        const filtered = prev.filter((s) => s.ticker !== newStock.ticker);
        return [newStock, ...filtered];
      });

      setSelectedTicker(newStock.ticker);
      showToast(
        alreadyCrossed
          ? `Added ${newStock.ticker} — Already above 20D Avg Vol! Latched at ${nowStr}.`
          : `Added ${newStock.ticker} — Monitoring Today Vol vs 20D Avg.`,
        alreadyCrossed ? 'emerald' : 'info'
      );
    },
    [clockSeconds, showToast]
  );

  const resetSimulation = useCallback(() => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
      setIsLiveStreaming(false);
    }
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
        isLiveStreaming,
        toasts,
        isJsonModalOpen,
        isAddStockModalOpen,
        isBrokerModalOpen,
        isOptionChainModalOpen,
        idempotencyLocks,
        totalMtmPnl,
        isSupabaseActive: isSupabaseConfigured,
        setSelectedTicker,
        setInstrumentMode: (mode) => setConfig((prev) => ({ ...prev, instrumentMode: mode })),
        setExecutionMode: (mode) => setConfig((prev) => ({ ...prev, executionMode: mode })),
        setCapitalPerTrade: (val) => setConfig((prev) => ({ ...prev, capitalPerTrade: val })),
        forceCrossover,
        executeBuy,
        panicKillSwitch,
        advancePositionState,
        addCustomStock,
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
        isAlertsModalOpen,
        isAuthModalOpen,
        isCloudLogsModalOpen,
        removeToast,
        showToast,
        brokerVaultStatus,
        refreshBrokerVaultStatus,
        marketSession,
        ingestionTelemetry,
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
