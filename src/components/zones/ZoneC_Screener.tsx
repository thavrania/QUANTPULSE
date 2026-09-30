'use client';

import React from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { getVolumeScreenerMetrics } from '@/lib/engine/crossoverEngine';

export function ZoneC_Screener() {
  const {
    watchlist,
    selectedTicker,
    setSelectedTicker,
    forceCrossover,
    idempotencyLocks,
    clockTime,
    feedMode,
    lastLiveSyncTime,
  } = useQuantPulse();

  const eligibleCount = watchlist.filter((s) => s.hasCrossed20D).length;

  return (
    <section className="bg-panel rounded-xl border border-slate-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-900/50">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Zone C: Live Stock Traded Shares vs. 20-Day Average Crossover Tracker
          </h2>
          <p className="text-[11px] text-slate-400">
            Stocks crossing their 20-Day Average Traded Shares latch the exact crossover time and become{' '}
            <strong className="text-emerald-300">ELIGIBLE FOR BUY</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {feedMode === 'DHAN_LIVE' ? (
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
              Live Dhan Feed {lastLiveSyncTime ? `(${lastLiveSyncTime})` : ''}
            </span>
          ) : (
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Simulated Feed
            </span>
          )}
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
            {eligibleCount} Eligible for Buy
          </span>
        </div>
      </div>

      {/* Screener Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 bg-obsidian/60">
              <th className="py-2.5 px-3">Stock</th>
              <th className="py-2.5 px-3">Today Traded Shares / 20D Avg Shares</th>
              <th className="py-2.5 px-3">Crossover Progress</th>
              <th className="py-2.5 px-3">Exact Crossover Time</th>
              <th className="py-2.5 px-3">Spot LTP &amp; Cross Price</th>
              <th className="py-2.5 px-3">Eligibility Status</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-xs">
            {watchlist.map((stock) => {
              const m = getVolumeScreenerMetrics(stock);
              const isSelectedRow = stock.ticker === selectedTicker;
              const barWidth = Math.min(100, Math.round(m.progressPct));
              const isTraded = idempotencyLocks.includes(stock.ticker);
              const todayShares = Math.round(stock.todayVolM * 1_000_000);
              const avg20DShares = Math.round(stock.avgVol20DM * 1_000_000);
              const deficitShares = Math.max(0, avg20DShares - todayShares);
              const surplusShares = Math.max(0, todayShares - avg20DShares);

              return (
                <tr
                  key={stock.ticker}
                  onClick={() => setSelectedTicker(stock.ticker)}
                  className={`cursor-pointer transition ${
                    stock.justCrossedHighlight ? 'animate-crossover-pulse bg-emerald-950/30' : ''
                  } ${isSelectedRow ? 'bg-slate-800/85' : 'hover:bg-slate-900/70'}`}
                >
                  {/* Stock, Sector & Contract Specs */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-white font-mono">{stock.ticker}</span>
                      {stock.shortName && stock.shortName !== stock.ticker && (
                        <span className="text-[11px] font-semibold text-cyan-300">
                          ({stock.shortName})
                        </span>
                      )}
                      {stock.sector && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          {stock.sector}
                        </span>
                      )}
                      {stock.feedSource === 'LIVE_DHAN' && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping"></span>
                          <span>LIVE</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-200 font-medium mt-0.5">{stock.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>Dhan ID: <strong className="text-slate-300">{stock.securityId || '1330'}</strong></span>
                      {stock.isin && (
                        <>
                          <span>•</span>
                          <span>ISIN: <strong className="text-slate-400">{stock.isin}</strong></span>
                        </>
                      )}
                      <span>•</span>
                      <span>Lot: <strong className="text-cyan-300">{stock.lotSize}</strong></span>
                    </div>
                  </td>

                  {/* Today Traded Shares vs 20-Day Avg Traded Shares */}
                  <td className="py-2.5 px-3 font-mono">
                    <div className={`font-bold text-xs ${m.isEligibleForBuy ? 'text-emerald-400' : 'text-slate-100'} flex items-center gap-1.5 flex-wrap`}>
                      <span>{todayShares.toLocaleString('en-IN')}</span>
                      <span className="text-slate-500 font-normal">/</span>
                      <span className="text-cyan-300 font-semibold">{avg20DShares.toLocaleString('en-IN')}</span>
                      <span className="text-[10px] text-slate-400 font-normal">shares</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ml-1 ${
                        m.rvolRatio >= 1.0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {m.rvolRatio}x RVOL
                      </span>
                    </div>
                    <div className={`text-[10px] mt-1 font-mono ${m.isEligibleForBuy ? 'text-emerald-300/90 font-bold' : 'text-slate-400'}`}>
                      {m.isEligibleForBuy
                        ? `🚀 Surplus: +${surplusShares.toLocaleString('en-IN')} shares`
                        : `Deficit: ${deficitShares.toLocaleString('en-IN')} shares remaining`}
                    </div>
                  </td>

                  {/* Crossover Progress Bar */}
                  <td className="py-2.5 px-3 font-mono w-40">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span
                        className={
                          m.isEligibleForBuy
                            ? 'text-emerald-400 font-bold'
                            : m.progressPct >= 90
                            ? 'text-amber-300 font-semibold'
                            : 'text-slate-400'
                        }
                      >
                        {m.progressPct}%
                      </span>
                      <span className="text-[10px] text-slate-500">Target: 100%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          m.isEligibleForBuy
                            ? 'bg-emerald-400'
                            : m.progressPct >= 90
                            ? 'bg-amber-400'
                            : 'bg-cyan-500/70'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </td>

                  {/* Exact Crossover Time (HH:MM:SS) */}
                  <td className="py-2.5 px-3 font-mono">
                    {stock.hasCrossed20D && stock.crossoverTime && stock.todayVolM >= stock.avgVol20DM ? (
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold text-[11px]">
                          ⏱️ {stock.crossoverTime} IST
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">Latched IST</div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500">⏳ Waiting...</span>
                    )}
                  </td>

                  {/* Spot LTP & Cross Price */}
                  <td className="py-2.5 px-3 font-mono">
                    <div className="flex items-center gap-1.5 font-bold text-white">
                      <span>₹{stock.spotLtp.toFixed(2)}</span>
                      {stock.changePct !== undefined && (
                        <span
                          className={`text-[10px] ${
                            stock.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {stock.changePct >= 0 ? '+' : ''}
                          {stock.changePct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] mt-0.5">
                      {stock.hasCrossed20D && stock.crossoverSpotPrice && stock.todayVolM >= stock.avgVol20DM ? (
                        <span className="text-amber-300 font-bold font-mono bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20">
                          Crossed @ ₹{stock.crossoverSpotPrice.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          {stock.dayHigh && stock.dayLow
                            ? `H: ₹${stock.dayHigh.toFixed(2)} • L: ₹${stock.dayLow.toFixed(2)}`
                            : `Open: ₹${(stock.dayOpen || stock.spotLtp).toFixed(2)}`}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Eligibility Status Badge */}
                  <td className="py-2.5 px-3">
                    {m.isEligibleForBuy ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        ✅ ELIGIBLE FOR BUY
                      </span>
                    ) : m.statusCode === 'HIGH_VOL_BEARISH' ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        title="Traded shares crossed 20D average but stock is below day open (red candle)"
                      >
                        ⚠️ SHARES CROSSED (BEARISH)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        TRACKING SHARES
                      </span>
                    )}
                  </td>

                  {/* Quick Test Action */}
                  <td className="py-2.5 px-3 text-right">
                    {!stock.hasCrossed20D ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          forceCrossover(stock.ticker);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition"
                        title="Force Today's Traded Shares to cross 20-Day Average right now"
                      >
                        ⚡ Cross 20D Shares Now
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                        {isTraded ? '🔒 Traded' : 'Ready → Zone D'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Interactive Guidance Footer */}
      <div className="px-3.5 py-2.5 bg-obsidian/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <div>
          ⚡ <strong className="text-slate-200">Live Market Streaming:</strong> When connected to Dhan HQ, prices and cumulative traded shares update every 2 seconds in real-time.
        </div>
        <div className="font-mono text-slate-400">Tick Clock: <span suppressHydrationWarning>{clockTime}</span> IST</div>
      </div>
    </section>
  );
}
