'use client';

import React from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';

export function ZoneE_Positions() {
  const {
    positions,
    config,
    idempotencyLocks,
    advancePositionState,
  } = useQuantPulse();

  const openPositions = positions.filter((p) => p.stateIndex < 4);

  return (
    <section className="max-w-[1920px] w-full mx-auto px-3 pb-4">
      <div className="bg-panel rounded-xl border border-slate-800 overflow-hidden shadow-lg">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
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
          </div>
        </div>

        {/* Positions Table */}
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
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-xs text-slate-400">
                    No active trades yet. Click <strong>&quot;Execute Buy&quot;</strong> on an eligible stock in Zone D or switch{' '}
                    <strong>Toggle 2 to AUTO TRADE</strong>.
                  </td>
                </tr>
              ) : (
                positions.map((pos) => {
                  const unitPnl = pos.currentLtp - pos.entryPrice;
                  const posPnl = +(unitPnl * pos.quantity).toFixed(2);

                  return (
                    <tr
                      key={pos.id}
                      className={pos.stateIndex === 4 ? 'opacity-60 bg-obsidian/40' : 'hover:bg-slate-900/60'}
                    >
                      {/* Order Time & Mode */}
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

                      {/* 20D Crossover Time */}
                      <td className="py-2.5 px-3 font-mono">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-[11px]">
                          ⏱️ {pos.crossoverTime}
                        </span>
                      </td>

                      {/* Instrument */}
                      <td className="py-2.5 px-3 font-mono font-bold text-white">{pos.symbol}</td>

                      {/* Quantity */}
                      <td className="py-2.5 px-3 font-mono text-cyan-300">
                        {pos.lots ? `${pos.lots} Lot (${pos.quantity})` : `${pos.quantity} Eq`}
                      </td>

                      {/* Entry Price */}
                      <td className="py-2.5 px-3 font-mono text-slate-200">₹{pos.entryPrice.toFixed(2)}</td>

                      {/* Current LTP */}
                      <td className="py-2.5 px-3 font-mono font-bold text-white">₹{pos.currentLtp.toFixed(2)}</td>

                      {/* Trailing SL */}
                      <td className="py-2.5 px-3 font-mono font-bold text-cyan-300">
                        ₹{pos.activeTrailingSl.toFixed(2)}
                      </td>

                      {/* Target */}
                      <td className="py-2.5 px-3 font-mono text-emerald-400">₹{pos.targetPrice.toFixed(2)}</td>

                      {/* TSL State */}
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border border-slate-700 bg-slate-800 text-slate-200">
                          {pos.stateLabel}
                        </span>
                      </td>

                      {/* P&L */}
                      <td
                        className={`py-2.5 px-3 font-mono font-bold ${
                          posPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {posPnl >= 0 ? '+' : ''}₹
                        {posPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* TSL Simulation Milestone Actions */}
                      <td className="py-2.5 px-3 text-right space-x-1">
                        {pos.stateIndex < 4 ? (
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
      </div>
    </section>
  );
}
