'use client';

import React, { useState, useEffect } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { TradeLog, TslAuditTrailEntry, CrossoverEvent, BrokerVaultEntry, LiveTickSnapshot, StockMasterItem } from '@/lib/types/quant';
import { formatTokenCountdown, maskToken } from '@/lib/services/brokerVaultService';
import { STOCK_MASTER_CATALOG } from '@/lib/stocks/stockMaster';

export function CloudAuditLogsModal() {
  const { showToast, isCloudLogsModalOpen, setIsCloudLogsModalOpen } = useQuantPulse();

  const onClose = () => setIsCloudLogsModalOpen(false);

  const [activeTab, setActiveTab] = useState<'TRADES' | 'TSL_TRAIL' | 'CROSSOVERS' | 'BROKER_VAULT' | 'TICK_SNAPSHOTS' | 'STOCK_MASTER'>('TRADES');
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([]);
  const [tslTrails, setTslTrails] = useState<TslAuditTrailEntry[]>([]);
  const [crossovers, setCrossovers] = useState<CrossoverEvent[]>([]);
  const [brokerVaultEntries, setBrokerVaultEntries] = useState<BrokerVaultEntry[]>([]);
  const [tickSnapshots, setTickSnapshots] = useState<LiveTickSnapshot[]>([]);
  const [stockMasterList, setStockMasterList] = useState<StockMasterItem[]>(STOCK_MASTER_CATALOG);
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

      // 4. Fetch Broker Vault Records
      try {
        const { data: vaultData, error: vaultErr } = await supabase
          .from('broker_vault')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (!vaultErr && vaultData) {
          setBrokerVaultEntries(vaultData as BrokerVaultEntry[]);
        }
      } catch {
        // table might be pending
      }

      // 5. Fetch Live Tick Snapshots
      try {
        const { data: snapData, error: snapErr } = await supabase
          .from('live_tick_snapshots')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (!snapErr && snapData) {
          setTickSnapshots(snapData as LiveTickSnapshot[]);
        }
      } catch {
        // table might be pending
      }

      // 6. Fetch Stock Master Universe
      try {
        const { data: masterData, error: masterErr } = await supabase
          .from('stock_master')
          .select('*')
          .order('ticker');

        if (!masterErr && masterData && masterData.length > 0) {
          const mappedMaster: StockMasterItem[] = masterData.map((d: any) => ({
            ticker: d.ticker,
            name: d.name,
            segment: d.segment,
            exchange: d.exchange || 'NSE',
            sector: d.sector,
            securityId: d.security_id,
            lotSize: d.lot_size,
            strikeStep: Number(d.strike_step),
            avgVol20DM: Number(d.avg_vol_20d_m),
            approxLtp: d.approx_ltp ? Number(d.approx_ltp) : undefined,
            isFnO: Boolean(d.is_fno),
          }));
          setStockMasterList(mappedMaster);
        } else {
          setStockMasterList(STOCK_MASTER_CATALOG);
        }
      } catch {
        setStockMasterList(STOCK_MASTER_CATALOG);
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panel border border-slate-700 rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
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
        <div className="px-5 pt-3 border-b border-slate-800 bg-slate-900/50 flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('TRADES')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'TRADES'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>📜</span>
            <span>Trade Logs Ledger ({tradeLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TSL_TRAIL')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'TSL_TRAIL'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>📈</span>
            <span>TSL Audit Trail ({tslTrails.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CROSSOVERS')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'CROSSOVERS'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>🚀</span>
            <span>20D Crossovers ({crossovers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BROKER_VAULT')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'BROKER_VAULT'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>🔑</span>
            <span>Broker Cloud Vault ({brokerVaultEntries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TICK_SNAPSHOTS')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'TICK_SNAPSHOTS'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>⚡</span>
            <span>Live Ticks Stream ({tickSnapshots.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STOCK_MASTER')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'STOCK_MASTER'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>🏛️</span>
            <span>All Stocks Master ({stockMasterList.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 text-slate-300">
          {activeTab === 'TRADES' && (
            <div className="overflow-x-auto">
              {tradeLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No trade logs found in Supabase yet. Execute a trade order in Zone B to see the permanent ledger!
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-obsidian/70">
                      <th className="py-2 px-2.5">Order ID</th>
                      <th className="py-2 px-2.5">Symbol</th>
                      <th className="py-2 px-2.5">Action</th>
                      <th className="py-2 px-2.5">Mode</th>
                      <th className="py-2 px-2.5">Qty / Lots</th>
                      <th className="py-2 px-2.5">Entry Price</th>
                      <th className="py-2 px-2.5">Stop Loss</th>
                      <th className="py-2 px-2.5">Target</th>
                      <th className="py-2 px-2.5">Status</th>
                      <th className="py-2 px-2.5 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {tradeLogs.map((log) => (
                      <tr key={log.id || log.order_id} className="hover:bg-slate-900/50">
                        <td className="py-2 px-2.5 text-cyan-300 font-bold">{log.order_id}</td>
                        <td className="py-2 px-2.5 font-bold text-white">{log.symbol}</td>
                        <td className="py-2 px-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.action === 'BUY'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2 px-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              log.routing_mode === 'LIVE_DHAN'
                                ? 'bg-rose-500/15 text-rose-300 font-bold'
                                : 'bg-cyan-500/15 text-cyan-300'
                            }`}
                          >
                            {log.routing_mode}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-slate-300">
                          {log.quantity} {log.lots ? `(${log.lots}L)` : ''}
                        </td>
                        <td className="py-2 px-2.5 text-white font-bold">₹{log.entry_price}</td>
                        <td className="py-2 px-2.5 text-rose-400">₹{log.stop_loss}</td>
                        <td className="py-2 px-2.5 text-emerald-400">₹{log.target_price}</td>
                        <td className="py-2 px-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'OPEN'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : log.status === 'CLOSED'
                                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right text-slate-400">
                          {new Date(log.created_at || '').toLocaleTimeString('en-IN')}
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
              {crossovers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No 20D volume crossovers recorded in the database yet.
                </div>
              ) : (
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
              )}
            </div>
          )}

          {activeTab === 'BROKER_VAULT' && (
            <div className="overflow-x-auto space-y-4">
              {brokerVaultEntries.length === 0 ? (
                <div className="p-6 bg-obsidian rounded-xl border border-slate-800 text-center space-y-2">
                  <div className="text-amber-400 font-bold text-sm">
                    No Broker Vault Records in Supabase Yet
                  </div>
                  <p className="text-slate-400 text-xs max-w-lg mx-auto">
                    To enable 24h cloud auto-auth across all your devices and automated Vercel Cron jobs:
                  </p>
                  <div className="text-left max-w-lg mx-auto bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-cyan-300">
                    1. Run <strong className="text-emerald-300">supabase_phase2_broker_vault.sql</strong> in your Supabase SQL Editor.<br />
                    2. In QuantPulse, open <strong className="text-white">🔌 Broker</strong> and click <strong className="text-emerald-300">☁️ Save &amp; Sync to Cloud Vault</strong>.
                  </div>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-obsidian/70">
                      <th className="py-2 px-2.5">Broker Gateway</th>
                      <th className="py-2 px-2.5">Client ID</th>
                      <th className="py-2 px-2.5">Masked Token</th>
                      <th className="py-2 px-2.5">Token Expiry &amp; Status</th>
                      <th className="py-2 px-2.5">Ping Latency</th>
                      <th className="py-2 px-2.5">Available Margin</th>
                      <th className="py-2 px-2.5 text-right">Primary Vault</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {brokerVaultEntries.map((entry, idx) => {
                      const countdown = formatTokenCountdown(entry.token_expiry_at);
                      return (
                        <tr key={entry.id || idx} className="hover:bg-slate-900/50">
                          <td className="py-2 px-2.5 font-bold text-white flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>{entry.broker_name}</span>
                          </td>
                          <td className="py-2 px-2.5 text-cyan-300 font-bold">{entry.client_id}</td>
                          <td className="py-2 px-2.5 text-slate-400">{maskToken(entry.access_token)}</td>
                          <td className="py-2 px-2.5">
                            {countdown.isExpired ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                🔴 Expired
                              </span>
                            ) : countdown.isExpiringSoon ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                ⚠️ {countdown.formatted} left
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                                🟢 {countdown.formatted} left
                              </span>
                            )}
                            <div className="text-[9px] text-slate-500 mt-0.5">
                              Exp: {new Date(entry.token_expiry_at).toLocaleTimeString('en-IN')} IST
                            </div>
                          </td>
                          <td className="py-2 px-2.5 text-slate-300">
                            {entry.last_ping_latency_ms ? `${entry.last_ping_latency_ms}ms` : 'N/A'}
                          </td>
                          <td className="py-2 px-2.5 text-emerald-400 font-bold">
                            ₹{Number(entry.available_margin || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2.5 text-right">
                            {entry.is_primary ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                                ⭐ ACTIVE PRIMARY
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">Archived</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'TICK_SNAPSHOTS' && (
            <div className="overflow-x-auto space-y-2">
              {tickSnapshots.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No tick snapshots recorded yet. When the Live Dhan Feed is active, tick snapshots are periodically saved to Supabase!
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-obsidian/70">
                      <th className="py-2 px-2.5">Symbol</th>
                      <th className="py-2 px-2.5">Spot Price (LTP)</th>
                      <th className="py-2 px-2.5">Today Traded Vol</th>
                      <th className="py-2 px-2.5">20D Avg Vol</th>
                      <th className="py-2 px-2.5">Relative Vol (RVOL)</th>
                      <th className="py-2 px-2.5 text-right">Timestamp IST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {tickSnapshots.map((snap, idx) => (
                      <tr key={snap.id || idx} className="hover:bg-slate-900/50">
                        <td className="py-2 px-2.5 font-bold text-white flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                          <span>{snap.ticker}</span>
                        </td>
                        <td className="py-2 px-2.5 font-bold text-emerald-400">
                          ₹{Number(snap.spot_ltp).toFixed(2)}
                        </td>
                        <td className="py-2 px-2.5 text-slate-200">
                          {Number(snap.today_vol_m).toFixed(2)}M
                        </td>
                        <td className="py-2 px-2.5 text-slate-400">
                          {Number(snap.avg_vol_20d_m).toFixed(2)}M
                        </td>
                        <td className="py-2 px-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              snap.rvol_ratio >= 1.0
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {snap.rvol_ratio}x RVOL
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right text-amber-300 font-bold">
                          ⏱️ {snap.timestamp_ist} IST
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'STOCK_MASTER' && (
            <div className="overflow-x-auto space-y-2">
              <div className="p-3 bg-obsidian rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>🏛️ Complete NSE High-Liquidity Stocks Master</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                      {stockMasterList.length} Symbols
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Repository of all eligible equities, derivatives, lot sizes, strike intervals, and Dhan Security IDs.
                  </div>
                </div>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-obsidian/70">
                    <th className="py-2 px-2.5">Symbol &amp; Company</th>
                    <th className="py-2 px-2.5">Segment &amp; Exch</th>
                    <th className="py-2 px-2.5">Sector</th>
                    <th className="py-2 px-2.5">Dhan Security ID</th>
                    <th className="py-2 px-2.5">Lot Size</th>
                    <th className="py-2 px-2.5">Strike Step</th>
                    <th className="py-2 px-2.5">20D Avg Vol</th>
                    <th className="py-2 px-2.5 text-right">Approx LTP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {stockMasterList.map((stock) => (
                    <tr key={stock.ticker} className="hover:bg-slate-900/50">
                      <td className="py-2 px-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white font-mono">{stock.ticker}</span>
                          {stock.shortName && stock.shortName !== stock.ticker && (
                            <span className="text-[10px] text-cyan-300 font-semibold font-sans">
                              ({stock.shortName})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-200 font-sans">{stock.name}</div>
                        {stock.isin && (
                          <div className="text-[9px] text-slate-500 font-mono">ISIN: {stock.isin}</div>
                        )}
                      </td>
                      <td className="py-2 px-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            stock.segment === 'NSE_FNO'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {stock.segment}
                        </span>
                        <span className="text-[9px] text-slate-500 ml-1">({stock.exchange})</span>
                      </td>
                      <td className="py-2 px-2.5 font-sans text-slate-300 text-[11px]">
                        {stock.sector}
                      </td>
                      <td className="py-2 px-2.5 text-cyan-300 font-bold">
                        {stock.securityId}
                      </td>
                      <td className="py-2 px-2.5 text-slate-200">
                        {stock.lotSize}
                      </td>
                      <td className="py-2 px-2.5 text-slate-300">
                        ₹{stock.strikeStep}
                      </td>
                      <td className="py-2 px-2.5 text-emerald-400 font-bold">
                        {stock.avgVol20DM.toFixed(2)}M
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold text-white">
                        ₹{stock.approxLtp?.toFixed(2) || '—'}
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
