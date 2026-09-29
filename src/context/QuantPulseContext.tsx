'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Stock,
  CrossoverEvent,
  Position,
  SystemConfig,
  InstrumentMode,
  ExecutionMode,
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
  idempotencyLocks: string[];
  totalMtmPnl: number;
  isSupabaseActive: boolean;

  // Actions
  setSelectedTicker: (ticker: string) => void;
  setInstrumentMode: (mode: InstrumentMode) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
  setCapitalPerTrade: (val: number) => void;
  forceCrossover: (ticker: string) => void;
  executeBuy: (ticker: string, triggeredBy?: ExecutionMode) => void;
  panicKillSwitch: () => void;
  advancePositionState: (posId: string, milestone: TslMilestone) => void;
  addCustomStock: (stock: Omit<Stock, 'hasCrossed20D' | 'crossoverTime' | 'crossoverSpotPrice'>) => void;
  toggleLiveStream: () => void;
  simulateSingleTick: () => void;
  resetSimulation: () => void;
  setIsJsonModalOpen: (open: boolean) => void;
  setIsAddStockModalOpen: (open: boolean) => void;
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
  const [idempotencyLocks, setIdempotencyLocks] = useState<string[]>([]);

  const streamTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback(
    (message: string, variant: 'info' | 'emerald' | 'amber' | 'rose' = 'info') => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3800);
    },
    []
  );

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
        }
        return updated;
      });

      // Check auto-mode dispatch
      runAutoScan(updatedWl, idempotencyLocks, positions);
      return updatedWl;
    });

    setPositions((prevPos) =>
      prevPos.map((pos) => autoUpdatePositionFromTick(pos))
    );
  }, [clockSeconds, idempotencyLocks, positions, runAutoScan, showToast]);

  const toggleLiveStream = useCallback(() => {
    if (isLiveStreaming) {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
      setIsLiveStreaming(false);
      showToast('Live Volume Stream paused.', 'amber');
    } else {
      setIsLiveStreaming(true);
      showToast('Live Volume Stream running — Watching 20D crossovers!', 'emerald');
      streamTimerRef.current = setInterval(() => {
        simulateSingleTick();
      }, 1500);
    }
  }, [isLiveStreaming, simulateSingleTick, showToast]);

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
          return updated;
        })
      );
    },
    [showToast]
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
        setIsJsonModalOpen,
        setIsAddStockModalOpen,
        removeToast,
        showToast,
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
