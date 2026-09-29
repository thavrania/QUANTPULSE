'use client';

import React, { useState, useEffect } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { TradeLog, TslAuditTrailEntry, CrossoverEvent } from '@/lib/types/quant';

export function CloudAuditLogsModal() {
  const { showToast, isCloudLogsModalOpen, setIsCloudLogsModalOpen } = useQuantPulse();

  const onClose = () => setIsCloudLogsModalOpen(false);

  const [activeTab, setActiveTab] = useState<'TRADES' | 'TSL_TRAIL' | 'CROSSOVERS'>('TRADES');
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([]);
  const [tslTrails, setTslTrails] = useState<TslAuditTrailEntry[]>([]);
  const [crossovers, setCrossovers] = useState<CrossoverEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  const fetchCloudLogs = async () => {
    if (!isSupabaseConfigured || !supabase) {
      showToast('Supabase is not configured yet.', 'amber');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch Trade Logs
      const { data: trades, error: tradesErr } = await supabase
        .from('trade_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!tradesErr && trades) {
        setTradeLogs(trades as TradeLog[]);
      }

      // 2. Fetch TSL Audit Trail
      const { data: tslData, error: tslErr } = await supabase
        .from('tsl_audit_trail')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!tslErr && tslData) {
        setTslTrails(tslData as TslAuditTrailEntry[]);
      }

      // 3. Fetch Crossover Events
      const { data: crossData, error: crossErr } = await supabase
        .from('crossover_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!crossErr && crossData) {
        setCrossovers(crossData as CrossoverEvent[]);
      }

      setLastRefreshed(new Date().toLocaleTimeString('en-IN'));
    } catch (err: any) {
      showToast(`Error fetching cloud logs: ${err.message}`, 'rose');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isCloudLogsModalOpen) {
      fetchCloudLogs();
    }
  }, [isCloudLogsModalOpen]);

  if (!isCloudLogsModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panel border border-slate-700 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-sm">
              📊
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Supabase Cloud Telemetry &amp; Audit Logs</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  PostgreSQL Vault Live
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Direct view of permanent records logged to your cloud database
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchCloudLogs}
              disabled={isLoading}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition flex items-center gap-1"
            >
              <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
              <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white text-sm px-2.5 py-1 rounded bg-slate-800"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Cloud Status Banner */}
        <div className="px-5 py-2 bg-obsidian border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span>Database:</span>
            <strong className="text-slate-200">cmcgvadapaoapxrxdcau.supabase.co</strong>
          </div>
          <div>
            Last Synced: <span className="text-cyan-300">{lastRefreshed || 'Connecting...'} IST</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 border-b border-slate-800 bg-slate-900/50 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('TRADES')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'TRADES'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>📜 Trade Orders Ledger</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
              {tradeLogs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TSL_TRAIL')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'TSL_TRAIL'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>📈 Trailing SL Milestones</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
              {tslTrails.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CROSSOVERS')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'CROSSOVERS'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>⏱️ 20D Crossover Audit Log</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
              {crossovers.length}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 flex-1 overflow-y-auto">
          {activeTab === 'TRADES' && (
            <div className="overflow-x-auto">
              {tradeLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No trade logs in Supabase yet. Place a trade in Zone D to see the permanent ledger update!
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-obsidian/70">
                      <th className="py-2 px-2.5">Order ID</th>
                      <th className="py-2 px-2.5">Symbol</th>
                      <th className="py-2 px-2.5">Action &amp; Mode</th>
                      <th className="py-2 px-2.5">Qty / Lots</th>
                      <th className="py-2 px-2.5">Entry Price</th>
                      <th className="py-2 px-2.5">Stop Loss</th>
                      <th className="py-2 px-2.5">Target</th>
                      <th className="py-2 px-2.5">Status</th>
                      <th className="py-2 px-2.5 text-right">Logged At (UTC)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {tradeLogs.map((log) => (
                      <tr key={log.order_id || log.id} className="hover:bg-slate-900/50">
                        <td className="py-2 px-2.5 text-cyan-300 font-bold">{log.order_id}</td>
                        <td className="py-2 px-2.5 font-bold text-white">{log.symbol}</td>
                        <td className="py-2 px-2.5">
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
                        <td className="py-2 px-2.5 text-slate-200">
                          {log.lots ? `${log.lots} Lot (${log.quantity})` : `${log.quantity} Eq`}
                        </td>
                        <td className="py-2 px-2.5 font-bold text-white">₹{log.entry_price}</td>
                        <td className="py-2 px-2.5 text-rose-400">₹{log.stop_loss}</td>
                        <td className="py-2 px-2.5 text-emerald-400">₹{log.target_price}</td>
                        <td className="py-2 px-2.5">
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
                        <td className="py-2 px-2.5 text-right text-[10px] text-slate-400">
                          {log.created_at ? new Date(log.created_at).toLocaleTimeString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'TSL_TRAIL' && (
            <div className="overflow-x-auto">
              {tslTrails.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No TSL transitions logged yet. As stock prices move in Zone E, trailing stop-loss milestones will be recorded here!
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-obsidian/70">
                      <th className="py-2 px-2.5">Position ID</th>
                      <th className="py-2 px-2.5">Symbol</th>
                      <th className="py-2 px-2.5">Transition Path</th>
                      <th className="py-2 px-2.5">Spot Price</th>
                      <th className="py-2 px-2.5">New Trailing SL</th>
                      <th className="py-2 px-2.5">Locked Profit</th>
                      <th className="py-2 px-2.5 text-right">Time IST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {tslTrails.map((trail, idx) => (
                      <tr key={trail.id || idx} className="hover:bg-slate-900/50">
                        <td className="py-2 px-2.5 text-cyan-300 font-bold">{trail.position_id}</td>
                        <td className="py-2 px-2.5 font-bold text-white">{trail.symbol}</td>
                        <td className="py-2 px-2.5">
                          <span className="text-amber-300">State {trail.from_state}</span>
                          <span className="mx-1 text-slate-500">→</span>
                          <span className="text-emerald-300 font-bold">State {trail.to_state}</span>
                          <div className="text-[10px] text-slate-400">{trail.to_label}</div>
                        </td>
                        <td className="py-2 px-2.5 text-white">₹{trail.spot_price_at_transition}</td>
                        <td className="py-2 px-2.5 text-emerald-400 font-bold">₹{trail.new_trailing_sl}</td>
                        <td className="py-2 px-2.5 font-bold text-emerald-300">+₹{trail.pnl_locked}</td>
                        <td className="py-2 px-2.5 text-right text-amber-300">{trail.timestamp_ist} IST</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'CROSSOVERS' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-obsidian/70">
                    <th className="py-2 px-2.5">Symbol</th>
                    <th className="py-2 px-2.5">Segment</th>
                    <th className="py-2 px-2.5">Exact Crossover Time</th>
                    <th className="py-2 px-2.5">Spot Price at Cross</th>
                    <th className="py-2 px-2.5">20D Avg Benchmark</th>
                    <th className="py-2 px-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {crossovers.map((cross, idx) => (
                    <tr key={cross.id || idx} className="hover:bg-slate-900/50">
                      <td className="py-2 px-2.5 font-bold text-white">{cross.ticker}</td>
                      <td className="py-2 px-2.5">
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded ${
                            cross.isFnO
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {cross.isFnO ? 'F&O' : 'CASH'}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 font-bold text-amber-300">
                        ⏱️ {cross.time} IST
                      </td>
                      <td className="py-2 px-2.5 font-bold text-emerald-400">
                        ₹{cross.crossPrice?.toFixed(2)}
                      </td>
                      <td className="py-2 px-2.5 text-slate-300">{cross.avgVol20DM}M</td>
                      <td className="py-2 px-2.5 text-right">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                          LATCHED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs">
          <div className="text-slate-400">
            Records are replicated in real-time via <strong className="text-cyan-300">Supabase WebSockets</strong>.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
