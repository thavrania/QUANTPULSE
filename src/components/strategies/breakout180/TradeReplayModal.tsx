'use client';

import React, { useState } from 'react';
import { TradeRecord } from '@/lib/strategies/niftyBreakout180/types';

interface TradeReplayModalProps {
  trade: TradeRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TradeReplayModal({ trade, isOpen, onClose }: TradeReplayModalProps) {
  const [activeTab, setActiveTab] = useState<'REPLAY' | 'AUDIT'>('REPLAY');

  if (!isOpen || !trade) return null;

  const isCe = trade.trigger_option === 'CE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-panel border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
              isCe ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {trade.trigger_option}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Trade Replay & Strategy Audit
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {trade.trading_date}
                </span>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                  trade.net_pnl >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {trade.net_pnl >= 0 ? `+₹${trade.net_pnl}` : `-₹${Math.abs(trade.net_pnl)}`}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {trade.trade_id} • Expiry: {trade.expiry}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab('REPLAY')}
                className={`px-3 py-1 rounded-md transition ${
                  activeTab === 'REPLAY' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Dual Timeline Replay
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('AUDIT')}
                className={`px-3 py-1 rounded-md transition ${
                  activeTab === 'AUDIT' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Strategy Audit Log
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* 1. SELECTION & TRIGGER SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* CE Frozen Contract */}
            <div className={`p-3.5 rounded-xl border ${
              isCe ? 'bg-emerald-500/5 border-emerald-500/40 ring-1 ring-emerald-500/20' : 'bg-slate-900/50 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Frozen CE Contract (09:25)
                </span>
                {isCe && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    TRIGGERED WINNER
                  </span>
                )}
              </div>
              <div className="text-sm font-mono text-white font-semibold">{trade.selected_ce_symbol}</div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-xs font-mono">
                <span className="text-slate-400">09:25 Ref Premium:</span>
                <span className="text-emerald-400 font-bold">₹{trade.selected_ce_925_premium}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono mt-1">
                <span className="text-slate-500">Distance from ₹180:</span>
                <span className="text-slate-300">₹{Math.abs(trade.selected_ce_925_premium - 180).toFixed(2)}</span>
              </div>
            </div>

            {/* PE Frozen Contract */}
            <div className={`p-3.5 rounded-xl border ${
              !isCe ? 'bg-rose-500/5 border-rose-500/40 ring-1 ring-rose-500/20' : 'bg-slate-900/50 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  Frozen PE Contract (09:25)
                </span>
                {!isCe && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                    TRIGGERED WINNER
                  </span>
                )}
              </div>
              <div className="text-sm font-mono text-white font-semibold">{trade.selected_pe_symbol}</div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-xs font-mono">
                <span className="text-slate-400">09:25 Ref Premium:</span>
                <span className="text-rose-400 font-bold">₹{trade.selected_pe_925_premium}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono mt-1">
                <span className="text-slate-500">Distance from ₹180:</span>
                <span className="text-slate-300">₹{Math.abs(trade.selected_pe_925_premium - 180).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 2. TRADE EXECUTION METRICS */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Trigger Time</span>
                <span className="text-cyan-400 font-bold">{trade.trigger_timestamp}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Entry Price</span>
                <span className="text-white font-bold">₹{trade.entry_price}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Stop Loss</span>
                <span className="text-rose-400 font-bold">₹{trade.stop_loss_price}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Target</span>
                <span className="text-emerald-400 font-bold">₹{trade.target_price}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Exit Price</span>
                <span className="text-white font-bold">₹{trade.exit_price}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Exit Reason</span>
                <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] inline-block ${
                  trade.exit_reason === 'TARGET_HIT'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : trade.exit_reason === 'SL_HIT'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                }`}>
                  {trade.exit_reason}
                </span>
              </div>
            </div>
          </div>

          {/* TAB CONTENT: TIMELINE REPLAY */}
          {activeTab === 'REPLAY' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>09:25 to 09:45 Chronological Premium Race (Target Level: ₹180)</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> CE Premium</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span> PE Premium</span>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/70">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">CE Premium</th>
                      <th className="py-2.5 px-3">PE Premium</th>
                      <th className="py-2.5 px-3">Distance to ₹180</th>
                      <th className="py-2.5 px-3">Strategy State / Event</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {trade.timeline && trade.timeline.map((point, i) => {
                      const isTriggerMinute = trade.trigger_timestamp.startsWith(point.timestamp);
                      const isEntryMinute = trade.entry_timestamp.startsWith(point.timestamp);
                      const isExitMinute = trade.exit_timestamp.startsWith(point.timestamp);

                      const ceCrossed = point.ceClose > 180;
                      const peCrossed = point.peClose > 180;

                      return (
                        <tr
                          key={i}
                          className={`transition ${
                            isTriggerMinute
                              ? 'bg-amber-500/10 font-bold'
                              : isEntryMinute
                              ? 'bg-emerald-500/10'
                              : isExitMinute
                              ? 'bg-cyan-500/10'
                              : 'hover:bg-slate-900/40'
                          }`}
                        >
                          <td className="py-2 px-3 text-slate-300 font-semibold">{point.timestamp}</td>
                          <td className={`py-2 px-3 ${ceCrossed ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                            ₹{point.ceClose} {ceCrossed && <span className="text-[10px] text-emerald-400 font-sans">▲ Cross</span>}
                          </td>
                          <td className={`py-2 px-3 ${peCrossed ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                            ₹{point.peClose} {peCrossed && <span className="text-[10px] text-rose-400 font-sans">▲ Cross</span>}
                          </td>
                          <td className="py-2 px-3 text-slate-400">
                            CE: {(point.ceClose - 180).toFixed(1)} | PE: {(point.peClose - 180).toFixed(1)}
                          </td>
                          <td className="py-2 px-3">
                            {isTriggerMinute ? (
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                                🚀 BREAKOUT: {trade.trigger_option} Crossed ₹180 First!
                              </span>
                            ) : isEntryMinute ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                                🛒 BUY ENTRY at ₹{trade.entry_price}
                              </span>
                            ) : isExitMinute ? (
                              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">
                                🏁 EXIT: {trade.exit_reason} at ₹{trade.exit_price}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-[11px]">
                                {point.timestamp < '09:30' ? 'Waiting Period' : 'Monitoring Breakout'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB CONTENT: AUDIT LOG */}
          {activeTab === 'AUDIT' && (
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80 p-3 space-y-2">
              <div className="text-xs font-mono text-slate-400 font-semibold mb-2">
                Strategy Execution Audit Trail ({trade.audit_trail?.length || 0} events logged)
              </div>
              <div className="space-y-1.5 font-mono text-xs max-h-96 overflow-y-auto pr-1">
                {trade.audit_trail && trade.audit_trail.map((log, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-1 px-2 rounded hover:bg-slate-900/60 border border-transparent hover:border-slate-800">
                    <span className="text-slate-500 shrink-0">{log.timestamp}</span>
                    <span className={`shrink-0 font-bold px-1.5 py-0.2 rounded text-[10px] ${
                      log.event.includes('TRIGGERED') || log.event.includes('BREAKOUT')
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : log.event.includes('HIT') || log.event.includes('EXIT')
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : log.event.includes('FROZEN')
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {log.event}
                    </span>
                    <span className="text-slate-300">{log.details}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-900/40 text-xs font-mono">
          <div className="flex items-center gap-4 text-slate-400">
            <span>Lot Size: <strong className="text-white">{trade.lot_size}</strong></span>
            <span>Quantity: <strong className="text-white">{trade.quantity}</strong></span>
            <span>Holding Time: <strong className="text-cyan-400">{trade.holding_duration}</strong></span>
            <span>Gross Points: <strong className={trade.gross_points >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {trade.gross_points > 0 ? `+${trade.gross_points}` : trade.gross_points}
            </strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
}
