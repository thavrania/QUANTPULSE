'use client';

import React, { useState, useEffect } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { getStockMasterByTicker, resolveStockMetadata } from '@/lib/stocks/stockMaster';

export function AddStockModal() {
  const { isAddStockModalOpen, setIsAddStockModalOpen, addCustomStock, addAllStocksToWatchlist } = useQuantPulse();

  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [segment, setSegment] = useState<'FNO' | 'CASH'>('FNO');
  const [spotLtp, setSpotLtp] = useState('1000');
  const [avgVol, setAvgVol] = useState('8.5');
  const [todayVol, setTodayVol] = useState('7.8');
  const [lotSize, setLotSize] = useState('250');
  const [detectedMaster, setDetectedMaster] = useState<any>(null);

  // Auto-detect & auto-fill official stock metadata when user enters a symbol (e.g. ETERNAL, TMCV)
  useEffect(() => {
    if (!ticker.trim()) {
      setDetectedMaster(null);
      return;
    }
    const master = getStockMasterByTicker(ticker);
    if (master) {
      setDetectedMaster(master);
      setName(master.name);
      setSegment(master.isFnO ? 'FNO' : 'CASH');
      setLotSize(String(master.lotSize));
      setAvgVol(String(master.avgVol20DM));
      if (master.approxLtp) {
        setSpotLtp(String(master.approxLtp));
      }
    } else {
      setDetectedMaster(null);
    }
  }, [ticker]);

  if (!isAddStockModalOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = ticker.trim().toUpperCase();
    if (!sym) return;

    const spot = parseFloat(spotLtp) || 1000;
    const avg = parseFloat(avgVol) || 10;
    const today = parseFloat(todayVol) || 0;

    const meta = resolveStockMetadata({
      ticker: sym,
      name: name.trim(),
      segment: segment === 'FNO' ? 'NSE_FNO' : 'NSE_EQ',
      lotSize: segment === 'FNO' ? parseInt(lotSize, 10) || 250 : 1,
      strikeStep: spot > 1500 ? 50 : 20,
      spotLtp: spot,
      avgVol20DM: avg,
      todayVolM: today,
    });

    addCustomStock({
      ticker: meta.ticker,
      shortName: meta.shortName,
      name: meta.name,
      isin: meta.isin,
      isFnO: meta.isFnO,
      segment: meta.segment,
      sector: meta.sector,
      securityId: meta.securityId,
      lotSize: meta.lotSize,
      strikeStep: meta.strikeStep,
      spotLtp: spot,
      avgVol20DM: avg,
      todayVolM: today,
      ivPct: meta.isFnO ? 19.5 : 0,
    });

    setTicker('');
    setName('');
    setDetectedMaster(null);
    setIsAddStockModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panel border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            Add Stock to 20-Day Traded Shares Monitor
          </h3>
          <button
            type="button"
            onClick={() => setIsAddStockModalOpen(false)}
            className="text-slate-400 hover:text-white text-sm px-2.5 py-1 rounded bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleAdd} className="p-5 space-y-3.5 text-xs text-slate-300">
          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1 font-semibold">
              Stock Ticker Symbol
            </label>
            <input
              type="text"
              placeholder="e.g. INFY, BAJFINANCE"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              required
              className="w-full bg-slate-900 text-xs font-mono uppercase text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-400"
            />
            {detectedMaster && (
              <div className="mt-1.5 p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-cyan-400 font-bold font-mono">{detectedMaster.ticker}</span>
                  <span className="text-white font-medium truncate">({detectedMaster.shortName})</span>
                  <span className="text-slate-400 text-[10px] truncate">— {detectedMaster.name}</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold font-mono">
                  VERIFIED
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1 font-semibold">
              Company Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Infosys Ltd"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900 text-xs text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1 font-semibold">Segment</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value as 'FNO' | 'CASH')}
                className="w-full bg-slate-900 text-xs text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-400"
              >
                <option value="FNO">F&amp;O (Stock + Option)</option>
                <option value="CASH">Cash Only (Stock Only)</option>
              </select>
            </div>
            {segment === 'FNO' && (
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1 font-semibold">Lot Size</label>
                <input
                  type="number"
                  value={lotSize}
                  onChange={(e) => setLotSize(e.target.value)}
                  className="w-full bg-slate-900 text-xs font-mono text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1 font-semibold">Spot LTP (₹)</label>
              <input
                type="number"
                step="0.05"
                value={spotLtp}
                onChange={(e) => setSpotLtp(e.target.value)}
                required
                className="w-full bg-slate-900 text-xs font-mono text-white px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1 font-semibold">20D Avg Shares (M)</label>
              <input
                type="number"
                step="0.05"
                value={avgVol}
                onChange={(e) => setAvgVol(e.target.value)}
                required
                className="w-full bg-slate-900 text-xs font-mono text-white px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1 font-semibold">Today Shares (M)</label>
              <input
                type="number"
                step="0.05"
                value={todayVol}
                onChange={(e) => setTodayVol(e.target.value)}
                required
                className="w-full bg-slate-900 text-xs font-mono text-white px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={async () => {
                await addAllStocksToWatchlist();
                setIsAddStockModalOpen(false);
              }}
              className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline flex items-center gap-1"
              title="Add all 55 constituents from Master Directory in a single action"
            >
              <span>⚡ Add All Stocks to Watch List</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddStockModalOpen(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition"
              >
                + Ingest Symbol
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
