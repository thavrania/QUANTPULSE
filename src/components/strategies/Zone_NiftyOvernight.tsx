'use client';

import React from 'react';
import { NiftyOvernightState } from '@/lib/types/quant';

interface ZoneNiftyOvernightProps {
  strategyState: NiftyOvernightState;
  onExecuteSelection?: () => void;
  onAdjustPrice?: (type: 'CE' | 'PE', delta: number) => void;
  onForceStopLoss?: (type: 'CE' | 'PE') => void;
  onForceNextDayExit?: () => void;
  onResetScenario?: () => void;
}

export function Zone_NiftyOvernight({
  strategyState,
  onExecuteSelection,
  onAdjustPrice,
  onForceStopLoss,
  onForceNextDayExit,
  onResetScenario,
}: ZoneNiftyOvernightProps) {
  const { ceLeg, peLeg } = strategyState;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'OVERNIGHT_HOLD':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'SL_HIT':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'NEXT_DAY_0925_EXIT':
      case 'NEXT_DAY_0925_EXIT_RECOVERY':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const ceBufferPct =
    ceLeg.stopLoss > 0
      ? ((ceLeg.currentPrice - ceLeg.stopLoss) / ceLeg.stopLoss) * 100
      : 0;
  const peBufferPct =
    peLeg.stopLoss > 0
      ? ((peLeg.currentPrice - peLeg.stopLoss) / peLeg.stopLoss) * 100
      : 0;

  return (
    <div className="space-y-4">
      {/* SECTION 21: PORTAL UI HEADER & TARGET INVARIANT NOTICE */}
      <div className="bg-panel rounded-xl border border-slate-800 p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl">🌙</span>
            <h2 className="text-base font-bold text-white tracking-tight">
              NIFTY 09:20 PREMIUM 62.5 OVERNIGHT
            </h2>
            <span
              className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded border ${getStatusBadgeVariant(
                strategyState.status
              )}`}
            >
              {strategyState.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Execution ID: <strong className="text-cyan-400">{strategyState.dailyExecutionId}</strong> • Selection strictly at 09:20 AM IST
          </p>
        </div>

        {/* Invariant Banner */}
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-1.5 text-xs text-rose-300 font-mono flex items-center gap-2">
          <span className="font-bold text-rose-400">⚠️ NO TARGET:</span>
          <span>Only 2 exits: <strong>Stop Loss (25%)</strong> or <strong>Next Day 09:25 AM IST</strong>.</span>
        </div>
      </div>

      {/* STRATEGY INFORMATION & OVERNIGHT HOLD SPECIFICATION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Strategy Information */}
        <div className="bg-panel rounded-xl border border-slate-800 p-4 shadow-lg space-y-3">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Strategy Information
            </h3>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between p-2 rounded bg-obsidian border border-slate-800">
              <span className="text-slate-400">Trading Date</span>
              <span className="font-bold text-white">{strategyState.tradingDate}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-obsidian border border-slate-800">
              <span className="text-slate-400">Selection Time</span>
              <span className="font-bold text-cyan-300">09:20 AM IST</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-obsidian border border-slate-800">
              <span className="text-slate-400">Selected Expiry</span>
              <span className="font-bold text-amber-300">{strategyState.selectedExpiry}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-obsidian border border-slate-800">
              <span className="text-slate-400">Expiry Override (Skip Today?)</span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                  strategyState.isTodayExpiry
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {strategyState.isTodayExpiry ? 'YES (Today Expiry Skipped)' : 'NO (Nearest Expiry Valid)'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-obsidian border border-slate-800">
              <span className="text-slate-400">Strategy Status</span>
              <span className="font-bold text-emerald-400">{strategyState.status}</span>
            </div>
          </div>
        </div>

        {/* Overnight Parameters */}
        <div className="bg-panel rounded-xl border border-slate-800 p-4 shadow-lg space-y-3">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Overnight Parameters &amp; Mandatory Exit
            </h3>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between p-2 rounded bg-obsidian border border-slate-800">
              <span className="text-slate-400">Overnight Hold Permitted</span>
              <span className="font-bold text-emerald-300">YES (Hold if SL not hit)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-obsidian border border-slate-800">
              <span className="text-slate-400">15:35 Intraday Square-Off</span>
              <span className="font-bold text-amber-300">BYPASSED (Exempted)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-obsidian border border-slate-800">
              <span className="text-slate-400">Next Valid Trading Day</span>
              <span className="font-bold text-cyan-300">{strategyState.nextTradingDay}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-obsidian border border-slate-800">
              <span className="text-slate-400">Mandatory Exit Time</span>
              <span className="font-bold text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                09:25 AM IST
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-obsidian border border-slate-800">
              <span className="text-slate-400">Target Profit Monitoring</span>
              <span className="font-bold text-rose-400">NONE (Strictly Disabled)</span>
            </div>
          </div>
        </div>

      </div>

      {/* CE & PE ACTIVE LEG CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* CE CARD */}
        <div className="bg-panel rounded-xl border border-slate-800 p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                Call Option (CE) Leg
              </span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getStatusBadgeVariant(ceLeg.status)}`}>
              {ceLeg.status}
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Symbol:</span>
              <span className="font-bold text-white text-sm">{ceLeg.symbol}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Strike &amp; Expiry:</span>
              <span className="text-slate-300">{ceLeg.strike || '—'} • {ceLeg.expiry}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-obsidian border border-slate-800">
              <span className="text-slate-400">09:20 Reference Price:</span>
              <span className="font-bold text-cyan-300 text-sm">
                {ceLeg.refPrice > 0 ? `₹${ceLeg.refPrice.toFixed(2)}` : 'Waiting for 09:20'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Distance from ₹62.50:</span>
              <span className="text-emerald-400 font-semibold">{ceLeg.distance.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-rose-500/10 border border-rose-500/30">
              <span className="text-rose-300 font-bold">Fixed Stop Loss (25%):</span>
              <span className="font-bold text-rose-400 text-sm">
                {ceLeg.stopLoss > 0 ? `₹${ceLeg.stopLoss.toFixed(2)}` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Current Market Price:</span>
              <span className="font-bold text-emerald-400 text-sm">
                {ceLeg.currentPrice > 0 ? `₹${ceLeg.currentPrice.toFixed(2)}` : '—'}
              </span>
            </div>

            {ceLeg.refPrice > 0 && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>SL: ₹{ceLeg.stopLoss.toFixed(2)}</span>
                  <span className={ceBufferPct >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    {ceBufferPct >= 0 ? `+${ceBufferPct.toFixed(1)}% above SL` : 'SL BREACHED'}
                  </span>
                  <span>Ref: ₹{ceLeg.refPrice.toFixed(2)}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className={ceLeg.currentPrice <= ceLeg.stopLoss ? 'bg-rose-500 h-2 rounded-full' : 'bg-emerald-400 h-2 rounded-full'}
                    style={{ width: `${Math.max(0, Math.min(100, (ceLeg.currentPrice / ceLeg.refPrice) * 100))}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PE CARD */}
        <div className="bg-panel rounded-xl border border-slate-800 p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                Put Option (PE) Leg
              </span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getStatusBadgeVariant(peLeg.status)}`}>
              {peLeg.status}
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Symbol:</span>
              <span className="font-bold text-white text-sm">{peLeg.symbol}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Strike &amp; Expiry:</span>
              <span className="text-slate-300">{peLeg.strike || '—'} • {peLeg.expiry}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-obsidian border border-slate-800">
              <span className="text-slate-400">09:20 Reference Price:</span>
              <span className="font-bold text-purple-300 text-sm">
                {peLeg.refPrice > 0 ? `₹${peLeg.refPrice.toFixed(2)}` : 'Waiting for 09:20'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Distance from ₹62.50:</span>
              <span className="text-emerald-400 font-semibold">{peLeg.distance.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-rose-500/10 border border-rose-500/30">
              <span className="text-rose-300 font-bold">Fixed Stop Loss (25%):</span>
              <span className="font-bold text-rose-400 text-sm">
                {peLeg.stopLoss > 0 ? `₹${peLeg.stopLoss.toFixed(2)}` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Current Market Price:</span>
              <span className="font-bold text-emerald-400 text-sm">
                {peLeg.currentPrice > 0 ? `₹${peLeg.currentPrice.toFixed(2)}` : '—'}
              </span>
            </div>

            {peLeg.refPrice > 0 && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>SL: ₹{peLeg.stopLoss.toFixed(2)}</span>
                  <span className={peBufferPct >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    {peBufferPct >= 0 ? `+${peBufferPct.toFixed(1)}% above SL` : 'SL BREACHED'}
                  </span>
                  <span>Ref: ₹{peLeg.refPrice.toFixed(2)}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className={peLeg.currentPrice <= peLeg.stopLoss ? 'bg-rose-500 h-2 rounded-full' : 'bg-emerald-400 h-2 rounded-full'}
                    style={{ width: `${Math.max(0, Math.min(100, (peLeg.currentPrice / peLeg.refPrice) * 100))}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* CLOSED TRADES / AFTER EXIT PERFORMANCE RECORD */}
      {(ceLeg.exitPrice || peLeg.exitPrice) && (
        <div className="bg-panel rounded-xl border border-slate-800 p-4 shadow-lg space-y-3">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              After Exit Performance &amp; Realized P&amp;L
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2">Leg</th>
                  <th className="p-2">Symbol</th>
                  <th className="p-2">09:20 Ref Price</th>
                  <th className="p-2">Stop Loss</th>
                  <th className="p-2">Exit Price</th>
                  <th className="p-2">Exit Timestamp</th>
                  <th className="p-2">Exit Reason</th>
                  <th className="p-2 text-right">Realized P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ceLeg.exitPrice && (
                  <tr>
                    <td className="p-2 text-cyan-400 font-bold">CE</td>
                    <td className="p-2 text-white">{ceLeg.symbol}</td>
                    <td className="p-2">₹{ceLeg.refPrice.toFixed(2)}</td>
                    <td className="p-2 text-rose-300">₹{ceLeg.stopLoss.toFixed(2)}</td>
                    <td className="p-2 font-bold text-white">₹{ceLeg.exitPrice.toFixed(2)}</td>
                    <td className="p-2 text-slate-400">{ceLeg.exitTime}</td>
                    <td className="p-2 text-amber-300 font-bold">{ceLeg.exitReason}</td>
                    <td className={`p-2 text-right font-bold ${(ceLeg.realizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {(ceLeg.realizedPnl || 0) >= 0 ? '+' : ''}₹{(ceLeg.realizedPnl || 0).toFixed(2)}
                    </td>
                  </tr>
                )}
                {peLeg.exitPrice && (
                  <tr>
                    <td className="p-2 text-purple-400 font-bold">PE</td>
                    <td className="p-2 text-white">{peLeg.symbol}</td>
                    <td className="p-2">₹{peLeg.refPrice.toFixed(2)}</td>
                    <td className="p-2 text-rose-300">₹{peLeg.stopLoss.toFixed(2)}</td>
                    <td className="p-2 font-bold text-white">₹{peLeg.exitPrice.toFixed(2)}</td>
                    <td className="p-2 text-slate-400">{peLeg.exitTime}</td>
                    <td className="p-2 text-amber-300 font-bold">{peLeg.exitReason}</td>
                    <td className={`p-2 text-right font-bold ${(peLeg.realizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {(peLeg.realizedPnl || 0) >= 0 ? '+' : ''}₹{(peLeg.realizedPnl || 0).toFixed(2)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
