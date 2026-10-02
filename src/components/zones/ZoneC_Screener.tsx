'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { getVolumeScreenerMetrics } from '@/lib/engine/crossoverEngine';

export type ScreenerSortOption =
  | 'PROGRESS_DESC'
  | 'PROGRESS_ASC'
  | 'ELIGIBLE_FIRST'
  | 'TICKER_ASC'
  | 'DEFAULT';

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

  // Sorting state - Defaults to Crossover Progress Percentage (Highest First)
  const [sortOption, setSortOption] = useState<ScreenerSortOption>('PROGRESS_DESC');

  // DOM refs for scrolling container & individual stock rows
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // Flash highlight state when a new stock is selected
  const [pulseTicker, setPulseTicker] = useState<string | null>(null);

  const isSim = feedMode === 'SIMULATION';
  const eligibleCount = watchlist.filter(
    (s) => s.hasCrossed20D || getVolumeScreenerMetrics(s, isSim).isEligibleForBuy
  ).length;

  // Sorted watchlist based on user selection
  const sortedWatchlist = useMemo(() => {
    const list = [...watchlist];
    switch (sortOption) {
      case 'PROGRESS_DESC':
        return list.sort((a, b) => {
          const mA = getVolumeScreenerMetrics(a, isSim);
          const mB = getVolumeScreenerMetrics(b, isSim);
          if (mB.progressPct !== mA.progressPct) {
            return mB.progressPct - mA.progressPct;
          }
          const aToday = a.todayTradedShares ?? Math.round(a.todayVolM * 1_000_000);
          const bToday = b.todayTradedShares ?? Math.round(b.todayVolM * 1_000_000);
          return bToday - aToday;
        });

      case 'PROGRESS_ASC':
        return list.sort((a, b) => {
          const mA = getVolumeScreenerMetrics(a, isSim);
          const mB = getVolumeScreenerMetrics(b, isSim);
          if (mA.progressPct !== mB.progressPct) {
            return mA.progressPct - mB.progressPct;
          }
          return a.ticker.localeCompare(b.ticker);
        });

      case 'ELIGIBLE_FIRST':
        return list.sort((a, b) => {
          const mA = getVolumeScreenerMetrics(a, isSim);
          const mB = getVolumeScreenerMetrics(b, isSim);
          if (mA.isEligibleForBuy !== mB.isEligibleForBuy) {
            return mA.isEligibleForBuy ? -1 : 1;
          }
          return mB.progressPct - mA.progressPct;
        });

      case 'TICKER_ASC':
        return list.sort((a, b) => a.ticker.localeCompare(b.ticker));

      case 'DEFAULT':
      default:
        return list;
    }
  }, [watchlist, sortOption]);

  // Smooth container-only scroll to selected row without displacing page
  const scrollToTicker = useCallback((ticker: string, smooth = true) => {
    const container = tableContainerRef.current;
    const row = rowRefs.current[ticker];
    if (!container || !row) return;

    const containerRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();

    // Sticky header offset (~46px)
    const stickyHeaderOffset = 46;

    // Check if row is already fully visible inside viewport
    const isFullyVisible =
      rowRect.top >= containerRect.top + stickyHeaderOffset &&
      rowRect.bottom <= containerRect.bottom - 10;

    if (!isFullyVisible) {
      const relativeTop = rowRect.top - containerRect.top + container.scrollTop;
      // Position row comfortably in the upper-middle of Zone C table
      const targetScrollTop = relativeTop - container.clientHeight / 2 + row.clientHeight / 2;

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  // When selectedTicker changes (e.g. clicked in Watchlist), auto scroll Zone C and pulse highlight
  useEffect(() => {
    if (!selectedTicker) return;

    setPulseTicker(selectedTicker);
    const pulseTimer = setTimeout(() => {
      setPulseTicker(null);
    }, 2800);

    const scrollTimer = setTimeout(() => {
      scrollToTicker(selectedTicker, true);
    }, 60);

    return () => {
      clearTimeout(pulseTimer);
      clearTimeout(scrollTimer);
    };
  }, [selectedTicker, sortOption, scrollToTicker]);

  // Toggle Crossover Progress sorting when clicking the column header
  const handleToggleProgressSort = () => {
    setSortOption((prev) => (prev === 'PROGRESS_DESC' ? 'PROGRESS_ASC' : 'PROGRESS_DESC'));
  };

  // Toggle Symbol sorting
  const handleToggleTickerSort = () => {
    setSortOption((prev) => (prev === 'TICKER_ASC' ? 'DEFAULT' : 'TICKER_ASC'));
  };

  return (
    <section className="bg-panel rounded-xl border border-slate-800 flex flex-col h-full overflow-hidden shadow-lg">
      {/* Header with Live Status & Sorting Controls */}
      <div className="p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/60">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Zone C: Live Stock Traded Shares vs. 20-Day Average Crossover Tracker
          </h2>
          <p className="text-[11px] text-slate-400">
            Stocks crossing their 20-Day Average Traded Shares latch exact crossover time &amp; become{' '}
            <strong className="text-emerald-300">ELIGIBLE FOR BUY</strong>
          </p>
        </div>

        {/* Toolbar: Sort Selector & Live Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Crossover Progress Sort Control */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-lg px-2 py-1 shadow-inner">
            <span className="text-[10px] font-mono uppercase text-slate-400">Sort:</span>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as ScreenerSortOption)}
              className="bg-transparent text-[11px] font-mono text-cyan-300 font-semibold focus:outline-none cursor-pointer"
              title="Select sorting algorithm for Zone C Screener table"
            >
              <option value="PROGRESS_DESC" className="bg-slate-900 text-cyan-300">
                🔥 Progress % (Highest First)
              </option>
              <option value="PROGRESS_ASC" className="bg-slate-900 text-amber-300">
                ❄️ Progress % (Lowest First)
              </option>
              <option value="ELIGIBLE_FIRST" className="bg-slate-900 text-emerald-300">
                ✅ Eligible for Buy First
              </option>
              <option value="TICKER_ASC" className="bg-slate-900 text-slate-200">
                🔤 Symbol (A → Z)
              </option>
              <option value="DEFAULT" className="bg-slate-900 text-slate-400">
                📋 Watchlist Default Order
              </option>
            </select>
          </div>

          {/* Feed Mode Badge */}
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

          {/* Counts */}
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
            {eligibleCount} Eligible for Buy
          </span>
          <span className="text-xs font-mono px-2 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {sortedWatchlist.length} Stocks
          </span>
        </div>
      </div>

      {/* Screener Table with Vertical Scroll & Sticky Header */}
      <div
        ref={tableContainerRef}
        className="overflow-y-auto overflow-x-auto flex-1 max-h-[620px] min-h-[400px] relative scroll-smooth scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50"
      >
        <table className="w-full text-left border-collapse relative">
          <thead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-md">
            <tr className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-900">
              {/* Stock Column Header with Sort Toggle */}
              <th
                onClick={handleToggleTickerSort}
                className="py-2.5 px-3 bg-slate-900 cursor-pointer select-none group hover:text-cyan-300 transition"
                title="Click to sort by Symbol (A-Z)"
              >
                <div className="flex items-center gap-1">
                  <span>Stock</span>
                  {sortOption === 'TICKER_ASC' ? (
                    <span className="text-cyan-400 font-bold">▲ A-Z</span>
                  ) : (
                    <span className="text-slate-600 group-hover:text-slate-400">⇅</span>
                  )}
                </div>
              </th>

              <th className="py-2.5 px-3 bg-slate-900">Today Traded Shares / 20D Avg Shares</th>

              {/* Crossover Progress Column Header with Sort Toggle */}
              <th
                onClick={handleToggleProgressSort}
                className="py-2.5 px-3 bg-slate-900 cursor-pointer select-none group hover:text-cyan-300 transition font-mono"
                title="Click to toggle sorting by Crossover Progress Percentage (High ↔ Low)"
              >
                <div className="flex items-center gap-1.5">
                  <span className="underline decoration-cyan-500/40 decoration-dotted underline-offset-4">
                    Crossover Progress
                  </span>
                  {sortOption === 'PROGRESS_DESC' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-0.5">
                      ▼ High→Low
                    </span>
                  )}
                  {sortOption === 'PROGRESS_ASC' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5">
                      ▲ Low→High
                    </span>
                  )}
                  {sortOption !== 'PROGRESS_DESC' && sortOption !== 'PROGRESS_ASC' && (
                    <span className="text-slate-600 group-hover:text-slate-400 text-xs">⇅</span>
                  )}
                </div>
              </th>

              <th className="py-2.5 px-3 bg-slate-900">Exact Crossover Time</th>
              <th className="py-2.5 px-3 bg-slate-900">Spot LTP &amp; Cross Price</th>
              <th className="py-2.5 px-3 bg-slate-900">Eligibility Status</th>
              <th className="py-2.5 px-3 bg-slate-900 text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/70 text-xs">
            {sortedWatchlist.map((stock) => {
              const isRowSim = feedMode === 'SIMULATION' || stock.feedSource === 'SIMULATED';
              const m = getVolumeScreenerMetrics(stock, isRowSim);
              const isSelectedRow = stock.ticker === selectedTicker;
              const isPulsing = pulseTicker === stock.ticker;
              const barWidth = Math.min(100, Math.round(m.progressPct));
              const isTraded = idempotencyLocks.includes(stock.ticker);
              const todayShares =
                stock.todayTradedShares !== undefined
                  ? stock.todayTradedShares
                  : Math.round(stock.todayVolM * 1_000_000);
              const avg20DShares =
                stock.avg20DTradedShares !== undefined
                  ? stock.avg20DTradedShares
                  : Math.round(stock.avgVol20DM * 1_000_000);
              const deficitShares = Math.max(0, avg20DShares - todayShares);
              const surplusShares = Math.max(0, todayShares - avg20DShares);

              return (
                <tr
                  key={stock.ticker}
                  ref={(el) => {
                    rowRefs.current[stock.ticker] = el;
                  }}
                  id={`zone-c-row-${stock.ticker}`}
                  onClick={() => setSelectedTicker(stock.ticker)}
                  className={`cursor-pointer transition-all duration-200 border-l-4 ${
                    isSelectedRow
                      ? 'border-l-cyan-400 bg-cyan-950/60 shadow-md'
                      : 'border-l-transparent hover:bg-slate-900/70'
                  } ${
                    isPulsing
                      ? 'ring-2 ring-cyan-400 ring-inset bg-cyan-900/40 shadow-[0_0_20px_rgba(6,182,212,0.35)]'
                      : ''
                  } ${stock.justCrossedHighlight ? 'animate-crossover-pulse bg-emerald-950/30' : ''}`}
                >
                  {/* Stock Identification */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-white font-mono">{stock.ticker}</span>
                      {stock.shortName &&
                        stock.shortName.trim().toUpperCase() !== stock.ticker.trim().toUpperCase() && (
                          <span className="text-[11px] font-semibold text-cyan-300">
                            ({stock.shortName})
                          </span>
                        )}
                      {isSelectedRow && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-400 text-slate-950 font-extrabold flex items-center gap-1 shadow-sm">
                          <span>🎯</span>
                          <span>SELECTED</span>
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
                      <span>
                        Dhan ID: <strong className="text-slate-300">{stock.securityId || '1330'}</strong>
                      </span>
                    </div>
                  </td>

                  {/* Today Traded Shares vs 20-Day Avg Traded Shares */}
                  <td className="py-2.5 px-3 font-mono">
                    <div
                      className={`font-bold text-xs ${
                        m.isEligibleForBuy ? 'text-emerald-400' : 'text-slate-100'
                      } flex items-center gap-1.5 flex-wrap`}
                    >
                      <span>{todayShares.toLocaleString('en-IN')}</span>
                      <span className="text-slate-500 font-normal">/</span>
                      <span className="text-cyan-300 font-semibold">{avg20DShares.toLocaleString('en-IN')}</span>
                      <span className="text-[10px] text-slate-400 font-normal">shares</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ml-1 ${
                          m.rvolRatio >= 1.0
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {m.rvolRatio}x RVOL
                      </span>
                    </div>
                    <div
                      className={`text-[10px] mt-1 font-mono ${
                        m.isEligibleForBuy ? 'text-emerald-300/90 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {m.isEligibleForBuy
                        ? `🚀 Surplus: +${surplusShares.toLocaleString('en-IN')} shares`
                        : `Deficit: ${deficitShares.toLocaleString('en-IN')} shares remaining`}
                    </div>
                  </td>

                  {/* Crossover Progress Bar with Highlighted Percentage */}
                  <td className="py-2.5 px-3 font-mono w-44">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span
                        className={`font-bold ${
                          m.isEligibleForBuy
                            ? 'text-emerald-400'
                            : m.progressPct >= 90
                            ? 'text-amber-300'
                            : m.progressPct >= 50
                            ? 'text-cyan-300'
                            : 'text-slate-400'
                        }`}
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
                    {stock.hasCrossed20D && stock.crossoverTime ? (
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
                      {stock.hasCrossed20D && stock.crossoverSpotPrice ? (
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

      {/* Interactive Guidance Footer with Jump-to-Selection & Status Info */}
      <div className="px-3.5 py-2.5 bg-obsidian/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-[11px] text-slate-400">
        <div className="flex items-center gap-2 flex-wrap">
          <span>
            ⚡ <strong className="text-slate-200">Scrollable Screener:</strong> Showing{' '}
            <strong className="text-cyan-300">{sortedWatchlist.length}</strong> monitored stocks.
          </span>
          {selectedTicker && (
            <button
              type="button"
              onClick={() => scrollToTicker(selectedTicker, true)}
              className="px-2 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-mono text-[10px] font-bold transition flex items-center gap-1"
              title="Center view on currently selected stock"
            >
              <span>🎯 Center Selected ({selectedTicker})</span>
            </button>
          )}
        </div>
        <div className="font-mono text-slate-400 flex items-center gap-2">
          <span>Sort: <strong className="text-cyan-300">{sortOption}</strong></span>
          <span>•</span>
          <span>Tick Clock: <span suppressHydrationWarning className="text-slate-200">{clockTime}</span> IST</span>
        </div>
      </div>
    </section>
  );
}
