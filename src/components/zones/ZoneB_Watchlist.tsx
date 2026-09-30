'use client';

import React, { useState, useMemo } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { STOCK_MASTER_CATALOG } from '@/lib/stocks/stockMaster';

export function ZoneB_Watchlist() {
  const {
    watchlist,
    crossoverEvents,
    selectedTicker,
    setSelectedTicker,
    addCustomStock,
    addStockFromMaster,
    removeStockFromWatchlist,
    currentTradingDate,
    isBaselineSyncing,
    syncDailyBaselines,
    resetToDayStart,
    clearCrossoverEvents,
  } = useQuantPulse();

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'MASTER_DIRECTORY'>('ACTIVE');
  const [directorySearch, setDirectorySearch] = useState('');
  const [indexFilter, setIndexFilter] = useState<'ALL' | 'NIFTY50' | 'SENSEX' | 'FNO'>('ALL');
  const [showAddForm, setShowAddForm] = useState(false);

  // Strictly enforce single entry per stock in the Exact Crossover Timestamp Feed
  const uniqueCrossoverEvents = useMemo(() => {
    const seen = new Set<string>();
    const list: typeof crossoverEvents = [];
    for (const ev of crossoverEvents) {
      if (!seen.has(ev.ticker)) {
        seen.add(ev.ticker);
        list.push(ev);
      }
    }
    return list;
  }, [crossoverEvents]);

  // Form states
  const [tickerInput, setTickerInput] = useState('');
  const [segmentInput, setSegmentInput] = useState<'FNO' | 'CASH'>('FNO');
  const [spotInput, setSpotInput] = useState('820');
  const [avgVolInput, setAvgVolInput] = useState('12.0');
  const [curVolInput, setCurVolInput] = useState('11.6');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = tickerInput.trim().toUpperCase();
    if (!sym) return;

    const spot = parseFloat(spotInput) || 1000;
    const avg = parseFloat(avgVolInput) || 10;
    const cur = parseFloat(curVolInput) || 0;

    addCustomStock({
      ticker: sym,
      name: `${sym} Custom Ltd`,
      isFnO: segmentInput === 'FNO',
      segment: segmentInput === 'FNO' ? 'NSE_FNO' : 'NSE_EQ',
      sector: 'Custom Watchlist Stock',
      securityId: '1330',
      lotSize: segmentInput === 'FNO' ? 250 : 1,
      strikeStep: spot > 1500 ? 50 : 20,
      spotLtp: spot,
      avgVol20DM: avg,
      todayVolM: cur,
      ivPct: segmentInput === 'FNO' ? 18.5 : 0,
    });

    setTickerInput('');
    setShowAddForm(false);
  };

  const activeTickers = new Set(watchlist.map((s) => s.ticker));

  const filteredMasterStocks = STOCK_MASTER_CATALOG.filter((stock) => {
    if (indexFilter === 'NIFTY50' && !stock.indices?.includes('NIFTY 50')) return false;
    if (indexFilter === 'SENSEX' && !stock.indices?.includes('SENSEX')) return false;
    if (indexFilter === 'FNO' && !stock.isFnO) return false;

    const q = directorySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      stock.ticker.toLowerCase().includes(q) ||
      stock.shortName?.toLowerCase().includes(q) ||
      stock.name.toLowerCase().includes(q) ||
      stock.sector.toLowerCase().includes(q) ||
      stock.securityId.includes(q) ||
      stock.indices?.some((idx) => idx.toLowerCase().includes(q))
    );
  });

  return (
    <section className="bg-panel rounded-xl border border-slate-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            Zone B: Watchlist &amp; Master Directory
          </h2>
          <p className="text-[11px] text-slate-400">
            Curated list of 4 focus stocks &amp; full NSE stock repository
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-semibold">
            {watchlist.length} Active
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {STOCK_MASTER_CATALOG.length} Universe
          </span>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="px-3 pt-2 bg-obsidian border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-3 py-1.5 rounded-t-lg font-semibold text-xs transition border-b-2 ${
              activeTab === 'ACTIVE'
                ? 'border-cyan-400 text-cyan-300 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            ⭐ Active Watchlist ({watchlist.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('MASTER_DIRECTORY')}
            className={`px-3 py-1.5 rounded-t-lg font-semibold text-xs transition border-b-2 ${
              activeTab === 'MASTER_DIRECTORY'
                ? 'border-amber-400 text-amber-300 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            📚 All Stocks Directory ({STOCK_MASTER_CATALOG.length})
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((p) => !p)}
          className="text-[10px] font-mono px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
        >
          {showAddForm ? '✕ Close Form' : '+ Custom Stock'}
        </button>
      </div>

      {/* Tab 1: Active Watchlist & Crossover Log */}
      {activeTab === 'ACTIVE' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Add Custom Stock Form (Collapsible) */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="p-3 border-b border-slate-800 bg-obsidian/70 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                <span>Add Stock to Traded Shares Tracker</span>
                <span className="text-[10px] text-slate-400">Today vs 20D Shares</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-0.5">Stock Symbol</label>
                  <input
                    type="text"
                    placeholder="e.g. SBIN"
                    value={tickerInput}
                    onChange={(e) => setTickerInput(e.target.value)}
                    required
                    className="w-full bg-slate-900 text-xs font-mono uppercase text-white px-2.5 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-0.5">Segment</label>
                  <select
                    value={segmentInput}
                    onChange={(e) => setSegmentInput(e.target.value as 'FNO' | 'CASH')}
                    className="w-full bg-slate-900 text-xs text-white px-2 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="FNO">F&amp;O (Stock + Option)</option>
                    <option value="CASH">Cash Only (Stock Only)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-0.5">Spot LTP (₹)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={spotInput}
                    onChange={(e) => setSpotInput(e.target.value)}
                    required
                    className="w-full bg-slate-900 text-xs font-mono text-white px-2 py-1 rounded border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-0.5">20D Avg(M)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={avgVolInput}
                    onChange={(e) => setAvgVolInput(e.target.value)}
                    required
                    className="w-full bg-slate-900 text-xs font-mono text-white px-2 py-1 rounded border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-0.5">Today Vol(M)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={curVolInput}
                    onChange={(e) => setCurVolInput(e.target.value)}
                    required
                    className="w-full bg-slate-900 text-xs font-mono text-white px-2 py-1 rounded border border-slate-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition"
              >
                + Add Stock to 20D Traded Shares Monitor
              </button>
            </form>
          )}

          {/* Active 4 Stocks Cards */}
          <div className="p-2.5 grid grid-cols-2 gap-2 border-b border-slate-800 bg-obsidian/40">
            {watchlist.map((stock) => {
              const isSelected = stock.ticker === selectedTicker;
              return (
                <div
                  key={stock.ticker}
                  onClick={() => setSelectedTicker(stock.ticker)}
                  className={`p-2.5 rounded-lg border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-cyan-400 bg-slate-900/90 shadow-md'
                      : 'border-slate-800 bg-obsidian/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white">{stock.ticker}</span>
                      {stock.shortName && stock.shortName.trim().toUpperCase() !== stock.ticker.trim().toUpperCase() && (
                        <span className="text-[10px] text-cyan-300 font-semibold font-sans">
                          ({stock.shortName})
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        stock.isFnO || stock.segment === 'NSE_FNO'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/35'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {stock.segment || (stock.isFnO ? 'NSE_FNO' : 'NSE_EQ')}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-medium truncate mt-0.5" title={stock.name}>
                    {stock.name}
                  </div>
                  {/* Stock Segment Details */}
                  <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">Segment:</span>
                    <strong className={stock.isFnO || stock.segment === 'NSE_FNO' ? 'text-purple-300' : 'text-slate-300'}>
                      {stock.segment || (stock.isFnO ? 'NSE_FNO' : 'NSE_EQ')}
                    </strong>
                    <span>•</span>
                    <span>Lot: <strong className="text-cyan-300">{stock.lotSize}</strong></span>
                    <span>•</span>
                    <span>Step: <strong className="text-slate-300">₹{stock.strikeStep}</strong></span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono mt-1.5 text-slate-300">
                    <span>₹{stock.spotLtp.toFixed(1)}</span>
                    <span className="text-cyan-300">
                      {Math.round(stock.avgVol20DM * 1_000_000).toLocaleString('en-IN')} shares
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[9px]">
                    <span className={stock.hasCrossed20D ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {stock.hasCrossed20D ? '✅ 20D Crossed' : '⏳ Tracking Shares'}
                    </span>
                    {watchlist.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeStockFromWatchlist(stock.ticker);
                        }}
                        className="text-slate-500 hover:text-rose-400 text-[10px]"
                        title="Remove from active watchlist"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pre-Market Automated 20D Baseline Sync Banner */}
          <div className="px-3 py-2 bg-obsidian/90 border-b border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2">
            <div>
              <div className="font-semibold text-white flex items-center gap-1.5 flex-wrap">
                <span>🌅 09:00 AM Pre-Market Engine</span>
                <span className="text-[10px] font-mono text-cyan-300">({currentTradingDate})</span>
              </div>
              <div className="text-[10px] text-slate-400">Automated 20D Traded Shares Baseline &amp; Session Engine</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isBaselineSyncing}
                onClick={() => syncDailyBaselines(false, true)}
                className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 disabled:opacity-50"
                title="Recalculate 20-Day traded shares baselines from the last 20 completed sessions"
              >
                <span>{isBaselineSyncing ? '⏳ Syncing...' : '⚡ 20D Sync'}</span>
              </button>
              <button
                type="button"
                disabled={isBaselineSyncing}
                onClick={() => resetToDayStart()}
                className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1 disabled:opacity-50"
                title="Reset session to Day Start: zero today's volume and evaluate fresh crossover progress"
              >
                <span>🔄 Day Start</span>
              </button>
            </div>
          </div>

          {/* Crossover Timestamp Event Log Title */}
          <div className="px-3 py-2 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span>⏱️ Exact Crossover Timestamp Feed</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">Live Latch</span>
              {uniqueCrossoverEvents.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearCrossoverEvents?.()}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 border border-slate-700 transition"
                  title="Clear crossover event log"
                >
                  Clear Feed
                </button>
              )}
            </div>
          </div>

          {/* Crossover Event Stream Container */}
          <div className="p-2.5 flex-1 overflow-y-auto space-y-2 max-h-[220px]">
            {uniqueCrossoverEvents.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No active watchlist stocks have crossed their 20-Day Average Traded Shares yet.
              </div>
            ) : (
              uniqueCrossoverEvents.map((ev) => (
                <div
                  key={ev.ticker}
                  onClick={() => setSelectedTicker(ev.ticker)}
                  className={`p-2.5 rounded-lg bg-obsidian/90 border transition cursor-pointer space-y-1 ${
                    selectedTicker === ev.ticker
                      ? 'border-emerald-400 bg-slate-900/90'
                      : 'border-emerald-500/30 hover:border-emerald-400/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white">{ev.ticker}</span>
                      <span
                        className={`text-[9px] font-mono px-1 py-0.2 rounded font-semibold ${
                          ev.isFnO
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {ev.isFnO ? 'NSE_FNO' : 'NSE_EQ'}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                        ELIGIBLE FOR BUY
                      </span>
                    </div>
                    <span className="font-mono text-[11px] font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                      ⏱️ {ev.time} IST
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono">
                    Crossed 20D Avg (<span className="text-white">{Math.round(ev.avgVol20DM * 1_000_000).toLocaleString('en-IN')} shares</span>) @ Spot{' '}
                    <span className="text-emerald-300 font-semibold">₹{ev.crossPrice.toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Master Directory of All Stocks */}
      {activeTab === 'MASTER_DIRECTORY' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search & Index Filter bar */}
          <div className="p-2.5 bg-obsidian/80 border-b border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">🔍</span>
              <input
                type="text"
                placeholder="Search NIFTY 50, SENSEX, Symbol, Company Name, or Security ID..."
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                className="w-full bg-slate-900 text-xs text-white px-2.5 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-amber-400 font-mono"
              />
              {directorySearch && (
                <button
                  type="button"
                  onClick={() => setDirectorySearch('')}
                  className="text-xs text-slate-400 hover:text-white px-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Index Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
              <span className="text-slate-500 font-semibold uppercase text-[9px] mr-1">Filter Index:</span>
              <button
                type="button"
                onClick={() => setIndexFilter('ALL')}
                className={`px-2 py-0.5 rounded font-mono font-semibold transition ${
                  indexFilter === 'ALL'
                    ? 'bg-amber-500 text-black font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                All Universe ({STOCK_MASTER_CATALOG.length})
              </button>
              <button
                type="button"
                onClick={() => setIndexFilter('NIFTY50')}
                className={`px-2 py-0.5 rounded font-mono font-semibold transition ${
                  indexFilter === 'NIFTY50'
                    ? 'bg-cyan-500 text-black font-bold'
                    : 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30'
                }`}
              >
                🇮🇳 NIFTY 50 ({STOCK_MASTER_CATALOG.filter((s) => s.indices?.includes('NIFTY 50')).length})
              </button>
              <button
                type="button"
                onClick={() => setIndexFilter('SENSEX')}
                className={`px-2 py-0.5 rounded font-mono font-semibold transition ${
                  indexFilter === 'SENSEX'
                    ? 'bg-purple-500 text-white font-bold'
                    : 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 border border-purple-500/30'
                }`}
              >
                🏛️ SENSEX 30 ({STOCK_MASTER_CATALOG.filter((s) => s.indices?.includes('SENSEX')).length})
              </button>
              <button
                type="button"
                onClick={() => setIndexFilter('FNO')}
                className={`px-2 py-0.5 rounded font-mono font-semibold transition ${
                  indexFilter === 'FNO'
                    ? 'bg-emerald-500 text-black font-bold'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                F&amp;O Only ({STOCK_MASTER_CATALOG.filter((s) => s.isFnO).length})
              </button>
            </div>
          </div>

          {/* Master Stocks Directory List (No Horizontal Scrollbar, Always Accessible Action Button) */}
          <div className="flex-1 overflow-y-auto max-h-[440px] divide-y divide-slate-800/80 overflow-x-hidden">
            {filteredMasterStocks.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No stocks match your filter or search query.
              </div>
            ) : (
              filteredMasterStocks.map((stock) => {
                const isInWatchlist = activeTickers.has(stock.ticker);
                return (
                  <div
                    key={stock.ticker}
                    className={`p-2.5 transition flex items-center justify-between gap-2.5 ${
                      isInWatchlist ? 'bg-cyan-950/20' : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-xs font-mono">{stock.ticker}</span>
                        {stock.shortName && stock.shortName.trim().toUpperCase() !== stock.ticker.trim().toUpperCase() && (
                          <span className="text-[10px] text-cyan-300 font-semibold font-sans">
                            ({stock.shortName})
                          </span>
                        )}
                        <span
                          className={`text-[8px] font-mono px-1 py-0.2 rounded font-semibold ${
                            stock.segment === 'NSE_FNO'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {stock.segment}
                        </span>
                        {stock.indices?.includes('NIFTY 50') && (
                          <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
                            NIFTY 50
                          </span>
                        )}
                        {stock.indices?.includes('SENSEX') && (
                          <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold">
                            SENSEX
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-200 font-sans truncate mt-0.5" title={stock.name}>
                        {stock.name}
                      </div>

                      <div className="text-[9px] text-slate-400 font-mono mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-400 truncate max-w-[140px]">{stock.sector}</span>
                        <span>•</span>
                        <span>Lot: <strong className="text-cyan-300">{stock.lotSize}</strong></span>
                        <span>•</span>
                        <span>Step: <strong className="text-slate-300">₹{stock.strikeStep}</strong></span>
                      </div>

                      <div className="text-[10px] font-mono text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="text-slate-400">20D Avg:</span>
                        <strong className="text-slate-100">
                          {Math.round(stock.avgVol20DM * 1_000_000).toLocaleString('en-IN')} shares
                        </strong>
                        {stock.approxLtp && (
                          <span className="text-emerald-400 font-semibold">
                            ~₹{stock.approxLtp.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Button: Always Visible & Accessible Without Horizontal Scrolling */}
                    <div className="flex-shrink-0 self-center">
                      {isInWatchlist ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold whitespace-nowrap">
                            ✓ In Watchlist
                          </span>
                          <button
                            type="button"
                            onClick={() => removeStockFromWatchlist(stock.ticker)}
                            className="text-[9px] text-slate-500 hover:text-rose-400 underline font-mono transition"
                            title={`Remove ${stock.ticker} from Active Watchlist`}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addStockFromMaster(stock)}
                          className="text-[10px] px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/50 font-bold transition flex items-center gap-1 shadow-sm whitespace-nowrap active:scale-95"
                          title={`Add ${stock.ticker} to Active Watchlist`}
                        >
                          <span>+ Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Logic Summary Box */}
      <div className="p-3 bg-obsidian/90 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
        <div className="font-semibold text-slate-200">Core Eligibility Rule:</div>
        <div>
          • Track <span className="text-cyan-300 font-mono">Today Traded Shares</span> vs{' '}
          <span className="text-white font-mono">20D Avg Traded Shares</span>
        </div>
        <div>
          • The instant <span className="text-emerald-400 font-mono">Today Shares ≥ 20D Avg Shares</span>, latch exact{' '}
          <span className="text-amber-300 font-mono">HH:MM:SS</span> crossover time &amp; unlock{' '}
          <span className="text-emerald-300 font-semibold">ELIGIBLE FOR BUY</span>.
        </div>
      </div>
    </section>
  );
}
