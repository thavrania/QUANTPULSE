'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { TradeLog, TslAuditTrailEntry } from '@/lib/types/quant';
import { generatePerformanceReport } from '@/lib/engine/targetTrackingEngine';

export function ZoneE_Positions() {
  const {
    positions,
    config,
    idempotencyLocks,
    advancePositionState,
    setIsCloudLogsModalOpen,
    clearAllPositionsAndTrades,
  } = useQuantPulse();

  const [subTab, setSubTab] = useState<'ACTIVE' | 'TRADE_LOGS' | 'TSL_TRAIL' | 'PERFORMANCE'>('ACTIVE');
  const [perfTimeframe, setPerfTimeframe] = useState<'DAILY' | 'WEEKLY' | 'YEARLY'>('DAILY');
  const [cloudTradeLogs, setCloudTradeLogs] = useState<TradeLog[]>([]);
  const [cloudTslTrails, setCloudTslTrails] = useState<TslAuditTrailEntry[]>([]);
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  const openPositions = positions.filter((p) => p.stateIndex < 4);

  const fetchCloudData = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setIsCloudLoading(true);
    try {
      const { data: tLogs } = await supabase
        .from('trade_logs')
        .select('*')
        .neq('status', 'CANCELLED')
        .order('created_at', { ascending: false })
        .limit(subTab === 'PERFORMANCE' ? 500 : 50);
      if (tLogs) setCloudTradeLogs(tLogs as TradeLog[]);

      const { data: tsls } = await supabase
        .from('tsl_audit_trail')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (tsls) setCloudTslTrails(tsls as TslAuditTrailEntry[]);
    } catch (err) {
      console.warn('Error fetching cloud data in Zone E:', err);
    } finally {
      setIsCloudLoading(false);
    }
  };

  const perfReport = useMemo(() => {
    return generatePerformanceReport(cloudTradeLogs, perfTimeframe);
  }, [cloudTradeLogs, perfTimeframe]);

  const filteredPerfTrades = useMemo(() => {
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffsetMs);
    const dateStr = istDate.toISOString().slice(0, 10);

    return cloudTradeLogs.filter((trade) => {
      if (!trade.created_at) return true;
      const tradeDate = trade.created_at.slice(0, 10);
      if (perfTimeframe === 'DAILY') {
        return tradeDate === dateStr;
      }
      if (perfTimeframe === 'WEEKLY') {
        const d = new Date(istDate);
        const day = d.getUTCDay();
        const diffToMon = (day === 0 ? -6 : 1) - day;
        const monday = new Date(d.getTime() + diffToMon * 86400000);
        const monStr = monday.toISOString().slice(0, 10);
        return tradeDate >= monStr && tradeDate <= dateStr;
      }
      if (perfTimeframe === 'YEARLY') {
        return tradeDate.startsWith(dateStr.slice(0, 4));
      }
      return true;
    });
  }, [cloudTradeLogs, perfTimeframe]);

  useEffect(() => {
    fetchCloudData();
  }, [subTab, positions.length]);

  return (
    <section className="max-w-[1920px] w-full mx-auto px-3 pb-4">
      <div className="bg-panel rounded-xl border border-slate-800 overflow-hidden shadow-lg">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Zone E: Executed Trades (Manual &amp; Auto) + Reference Crossover Timestamp
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
              Open Positions: {openPositions.length} / {config.maxOpenPositions} Max
            </span>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
              Auto-Trade Locks: {idempotencyLocks.length} Tickers
            </span>
            <button
              type="button"
              onClick={async () => {
                setCloudTradeLogs([]);
                setCloudTslTrails([]);
                await clearAllPositionsAndTrades();
                await fetchCloudData();
              }}
              className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-semibold transition flex items-center gap-1 cursor-pointer"
              title="Wipe all open positions, trade logs, and stale crossovers for a clean fresh start"
            >
              <span>🧹 Reset Positions &amp; Trades</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCloudLogsModalOpen(true)}
              className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-semibold transition flex items-center gap-1"
              title="Open full-screen cloud telemetry modal"
            >
              <span>⛶ Expand Audit Viewer</span>
            </button>
          </div>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="px-4 py-1.5 border-b border-slate-800 bg-obsidian flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubTab('ACTIVE')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                subTab === 'ACTIVE'
                  ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚡ Live Active Positions ({openPositions.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setSubTab('TRADE_LOGS');
                fetchCloudData();
              }}
              className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                subTab === 'TRADE_LOGS'
                  ? 'bg-slate-800 text-emerald-300 border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📜 Supabase Cloud Ledger</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-emerald-400 font-bold">
                {cloudTradeLogs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSubTab('TSL_TRAIL');
                fetchCloudData();
              }}
              className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                subTab === 'TSL_TRAIL'
                  ? 'bg-slate-800 text-amber-300 border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📈 TSL Milestone Audit</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-amber-400 font-bold">
                {cloudTslTrails.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSubTab('PERFORMANCE');
                fetchCloudData();
              }}
              className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                subTab === 'PERFORMANCE'
                  ? 'bg-slate-800 text-purple-300 border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📊 Performance &amp; Pi% Targets</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {subTab === 'TRADE_LOGS' && cloudTradeLogs.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (supabase) {
                    await supabase
                      .from('trade_logs')
                      .update({ status: 'CANCELLED' })
                      .neq('id', '00000000-0000-0000-0000-000000000000');
                    setCloudTradeLogs([]);
                  }
                }}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition flex items-center gap-1"
                title="Cancel and clear executed orders from cloud ledger"
              >
                <span>Clear Ledger</span>
              </button>
            )}
            <button
              type="button"
              onClick={fetchCloudData}
              disabled={isCloudLoading}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1"
            >
              <span className={isCloudLoading ? 'animate-spin' : ''}>🔄</span>
              <span>{isCloudLoading ? 'Syncing...' : 'Sync Cloud'}</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Live Positions */}
        {subTab === 'ACTIVE' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 bg-obsidian/60">
                  <th className="py-2 px-3">Order Time &amp; Mode</th>
                  <th className="py-2 px-3">20D Vol Cross Time</th>
                  <th className="py-2 px-3">Instrument Bought</th>
                  <th className="py-2 px-3">Qty / Lots</th>
                  <th className="py-2 px-3">Entry Price</th>
                  <th className="py-2 px-3">Current LTP</th>
                  <th className="py-2 px-3">Active Trailing SL</th>
                  <th className="py-2 px-3">Target (1:2)</th>
                  <th className="py-2 px-3">TSL State</th>
                  <th className="py-2 px-3">Live P&amp;L</th>
                  <th className="py-2 px-3 text-right">Trailing SL Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {openPositions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-xs text-slate-400">
                      No active trades in local memory. Dispatched trades are permanently archived in the{' '}
                      <strong
                        onClick={() => setSubTab('TRADE_LOGS')}
                        className="text-cyan-300 cursor-pointer underline"
                      >
                        Supabase Cloud Ledger
                      </strong>.
                    </td>
                  </tr>
                ) : (
                  openPositions.map((pos) => {
                    const unitPnl = pos.currentLtp - pos.entryPrice;
                    const posPnl = +(unitPnl * pos.quantity).toFixed(2);

                    return (
                      <tr
                        key={pos.id}
                        className={pos.stateIndex === 4 ? 'opacity-60 bg-obsidian/40' : 'hover:bg-slate-900/60'}
                      >
                        <td className="py-2.5 px-3 font-mono">
                          <div className="text-slate-200">{pos.orderTime}</div>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                              pos.executionMode === 'AUTO'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            {pos.executionMode}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-[11px]">
                            ⏱️ {pos.crossoverTime}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-white">{pos.symbol}</td>
                        <td className="py-2.5 px-3 font-mono text-cyan-300">
                          {pos.lots ? `${pos.lots} Lot (${pos.quantity})` : `${pos.quantity} Eq`}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-200">₹{pos.entryPrice.toFixed(2)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-white">₹{pos.currentLtp.toFixed(2)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-cyan-300">
                          ₹{pos.activeTrailingSl.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {pos.strategy_id === 'NIFTY_0920_PREMIUM_625_OVERNIGHT' || pos.strategyId === 'NIFTY_0920_PREMIUM_625_OVERNIGHT' ? (
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              NONE (No Target)
                            </span>
                          ) : (
                            <>
                              <div className="text-emerald-400">₹{pos.targetPrice.toFixed(2)}</div>
                              {pos.highestTargetAchieved && pos.highestTargetAchieved !== 'NONE' ? (
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  🎯 {pos.highestTargetAchieved}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500">T1: ₹{pos.target1 ? pos.target1.toFixed(1) : '-'}</span>
                              )}
                            </>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border border-slate-700 bg-slate-800 text-slate-200">
                            {pos.stateLabel}
                          </span>
                        </td>
                        <td
                          className={`py-2.5 px-3 font-mono font-bold ${
                            posPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {posPnl >= 0 ? '+' : ''}₹
                          {posPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1">
                          {pos.strategy_id === 'NIFTY_0920_PREMIUM_625_OVERNIGHT' || pos.strategyId === 'NIFTY_0920_PREMIUM_625_OVERNIGHT' ? (
                            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                              Fixed 25% SL • Exit @ 09:25
                            </span>
                          ) : pos.stateIndex < 4 ? (
                            <>
                              <button
                                type="button"
                                onClick={() => advancePositionState(pos.id, 'PLUS_1R')}
                                className="px-2 py-1 rounded text-[10px] font-mono bg-slate-800 hover:bg-cyan-500/20 text-cyan-300 border border-slate-700"
                              >
                                +1R Lock
                              </button>
                              <button
                                type="button"
                                onClick={() => advancePositionState(pos.id, 'PLUS_2R')}
                                className="px-2 py-1 rounded text-[10px] font-mono bg-slate-800 hover:bg-emerald-500/20 text-emerald-300 border border-slate-700"
                              >
                                +2R Trail
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const clientId = localStorage.getItem('qp_dhan_client_id') || '';
                                    const accessToken = localStorage.getItem('qp_dhan_access_token') || '';
                                    await fetch('/api/broker/dhan/square-off', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        positionId: pos.id,
                                        ticker: pos.ticker,
                                        symbol: pos.symbol,
                                        quantity: pos.quantity,
                                        instrumentType: pos.instrumentType,
                                        isPaper: !pos.id.startsWith('DHAN'),
                                        clientId,
                                        accessToken,
                                      }),
                                    });
                                  } catch {
                                    // fallback
                                  }
                                  advancePositionState(pos.id, 'EXIT');
                                }}
                                className="px-2 py-1 rounded text-[10px] font-mono bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold"
                                title="Square off position and exit"
                              >
                                ⚡ Square Off
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">CLOSED</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Supabase Cloud Trade Ledger */}
        {subTab === 'TRADE_LOGS' && (
          <div className="overflow-x-auto">
            {cloudTradeLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No orders recorded in Supabase <code>public.trade_logs</code> yet.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-obsidian/60">
                    <th className="py-2 px-3">Order ID</th>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3">Action &amp; Mode</th>
                    <th className="py-2 px-3">Qty / Lots</th>
                    <th className="py-2 px-3">Entry Price</th>
                    <th className="py-2 px-3">Stop Loss</th>
                    <th className="py-2 px-3">Target</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Logged At (Cloud)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {cloudTradeLogs.map((log) => (
                    <tr key={log.order_id || log.id} className="hover:bg-slate-900/60">
                      <td className="py-2 px-3 text-cyan-300 font-bold">{log.order_id}</td>
                      <td className="py-2 px-3 font-bold text-white">{log.symbol}</td>
                      <td className="py-2 px-3">
                        <span className="text-emerald-400 font-bold mr-1">{log.action}</span>
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded ${
                            log.routing_mode === 'LIVE_DHAN'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {log.routing_mode}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-200">
                        {log.lots ? `${log.lots} Lot (${log.quantity})` : `${log.quantity} Eq`}
                      </td>
                      <td className="py-2 px-3 font-bold text-white">₹{log.entry_price}</td>
                      <td className="py-2 px-3 text-rose-400">₹{log.stop_loss}</td>
                      <td className="py-2 px-3 text-emerald-400">₹{log.target_price}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            log.status === 'OPEN'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : log.status === 'CLOSED'
                              ? 'bg-slate-800 text-slate-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-[10px] text-slate-400">
                        {log.created_at ? new Date(log.created_at).toLocaleTimeString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 3: TSL Milestone Audit */}
        {subTab === 'TSL_TRAIL' && (
          <div className="overflow-x-auto">
            {cloudTslTrails.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No TSL transitions recorded in Supabase <code>public.tsl_audit_trail</code> yet.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-obsidian/60">
                    <th className="py-2 px-3">Position ID</th>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3">State Transition</th>
                    <th className="py-2 px-3">Spot Price</th>
                    <th className="py-2 px-3">New Trailing SL</th>
                    <th className="py-2 px-3">Locked Profit</th>
                    <th className="py-2 px-3 text-right">Time IST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {cloudTslTrails.map((trail, idx) => (
                    <tr key={trail.id || idx} className="hover:bg-slate-900/60">
                      <td className="py-2 px-3 text-cyan-300 font-bold">{trail.position_id}</td>
                      <td className="py-2 px-3 font-bold text-white">{trail.symbol}</td>
                      <td className="py-2 px-3">
                        <span className="text-amber-300">State {trail.from_state}</span>
                        <span className="mx-1 text-slate-500">→</span>
                        <span className="text-emerald-300 font-bold">State {trail.to_state}</span>
                        <div className="text-[10px] text-slate-400">{trail.to_label}</div>
                      </td>
                      <td className="py-2 px-3 text-white">₹{trail.spot_price_at_transition}</td>
                      <td className="py-2 px-3 text-emerald-400 font-bold">₹{trail.new_trailing_sl}</td>
                      <td className="py-2 px-3 font-bold text-emerald-300">+₹{trail.pnl_locked}</td>
                      <td className="py-2 px-3 text-right text-amber-300">{trail.timestamp_ist} IST</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 4: Performance & Pi% Targets */}
        {subTab === 'PERFORMANCE' && (
          <div className="p-4 space-y-4">
            {/* Control Bar: Timeframe Selector & Pi% Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-obsidian/80 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">Timeframe:</span>
                {(['DAILY', 'WEEKLY', 'YEARLY'] as const).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setPerfTimeframe(tf)}
                    className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                      perfTimeframe === tf
                        ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <span>{tf === 'DAILY' ? '📅 Today (Daily)' : tf === 'WEEKLY' ? '🗓️ This Week' : '📊 Year to Date'}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-[11px] font-mono bg-slate-900/90 px-3 py-1.5 rounded border border-slate-800">
                <span className="text-purple-300 font-bold">π = 3.1416%</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">T1: <strong className="text-purple-300">+3.14%</strong></span>
                <span className="text-slate-400">T2: <strong className="text-blue-300">+4.71%</strong></span>
                <span className="text-slate-400">T3: <strong className="text-emerald-300">+6.28%</strong></span>
                <span className="text-slate-400">T4: <strong className="text-amber-300">+7.85%</strong></span>
              </div>
            </div>

            {/* Performance Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Trades</div>
                <div className="text-xl font-bold font-mono text-white mt-1">{perfReport.totalTrades}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Executed orders</div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Hit Rate (≥ T1)</div>
                <div className="text-xl font-bold font-mono text-purple-300 mt-1">
                  {perfReport.targetAchievementPercentage}%
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Target reached</div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">T1 Reached</div>
                <div className="text-xl font-bold font-mono text-purple-400 mt-1">{perfReport.t1AchievedCount}</div>
                <div className="text-[10px] text-purple-300/80 mt-0.5">+3.14% BuyVal</div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">T2 Reached</div>
                <div className="text-xl font-bold font-mono text-blue-400 mt-1">{perfReport.t2AchievedCount}</div>
                <div className="text-[10px] text-blue-300/80 mt-0.5">+4.71% BuyVal</div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">T3 &amp; T4 Apex</div>
                <div className="text-xl font-bold font-mono text-amber-300 mt-1">
                  {perfReport.t3AchievedCount} <span className="text-xs text-slate-500 font-normal">/</span> {perfReport.t4AchievedCount}
                </div>
                <div className="text-[10px] text-amber-300/80 mt-0.5">T3: +6.28% | T4: +7.85%</div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Realized P&amp;L</div>
                <div
                  className={`text-xl font-bold font-mono mt-1 ${
                    perfReport.grossPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {perfReport.grossPnl >= 0 ? '+' : ''}₹{perfReport.grossPnl.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Closed positions</div>
              </div>
            </div>

            {/* Trades Target Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              {filteredPerfTrades.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 bg-obsidian/40">
                  No trades found for {perfTimeframe} period in Supabase <code>public.trade_logs</code>.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-obsidian/80">
                      <th className="py-2.5 px-3">Symbol</th>
                      <th className="py-2.5 px-3">Side</th>
                      <th className="py-2.5 px-3">Qty</th>
                      <th className="py-2.5 px-3">Entry Price</th>
                      <th className="py-2.5 px-3">Buy Value</th>
                      <th className="py-2.5 px-3 text-purple-300">T1 (+π%)</th>
                      <th className="py-2.5 px-3 text-blue-300">T2 (+1.5π%)</th>
                      <th className="py-2.5 px-3 text-emerald-300">T3 (+2π%)</th>
                      <th className="py-2.5 px-3 text-amber-300">T4 (+2.5π%)</th>
                      <th className="py-2.5 px-3">Highest Achieved</th>
                      <th className="py-2.5 px-3">Milestone Time</th>
                      <th className="py-2.5 px-3 text-right">Realized P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 font-mono">
                    {filteredPerfTrades.map((t) => {
                      const highest = t.highest_target_achieved || 'NONE';
                      const pnl = Number(t.realized_pnl) || 0;
                      return (
                        <tr key={t.id || t.order_id} className="hover:bg-slate-900/60 transition">
                          <td className="py-2 px-3 font-bold text-white flex items-center gap-1.5">
                            <span>{t.symbol}</span>
                            {t.lots && (
                              <span className="text-[10px] font-normal text-slate-400">({t.lots}L)</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                t.action === 'BUY'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {t.action}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300">{t.quantity}</td>
                          <td className="py-2 px-3 text-white font-semibold">₹{t.entry_price}</td>
                          <td className="py-2 px-3 text-slate-400">
                            ₹{t.buy_value ? Number(t.buy_value).toLocaleString('en-IN') : (t.entry_price * t.quantity).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-3 text-purple-300">
                            {t.target_1 ? `₹${t.target_1}` : '—'}
                          </td>
                          <td className="py-2 px-3 text-blue-300">
                            {t.target_2 ? `₹${t.target_2}` : '—'}
                          </td>
                          <td className="py-2 px-3 text-emerald-300">
                            {t.target_3 ? `₹${t.target_3}` : '—'}
                          </td>
                          <td className="py-2 px-3 text-amber-300">
                            {t.target_4 ? `₹${t.target_4}` : '—'}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                highest === 'T4'
                                  ? 'bg-amber-400 text-black font-black'
                                  : highest === 'T3'
                                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                                  : highest === 'T2'
                                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                                  : highest === 'T1'
                                  ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              {highest === 'NONE' ? 'NO TARGET' : `🎯 ${highest}`}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[11px] text-amber-300/90">
                            {t.target_achievement_time || '—'}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-bold ${
                              pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-rose-400' : 'text-slate-400'
                            }`}
                          >
                            {pnl > 0 ? '+' : ''}₹{pnl.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
