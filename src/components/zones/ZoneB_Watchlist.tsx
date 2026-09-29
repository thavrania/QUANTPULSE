'use client';

import React, { useState } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';

export function ZoneB_Watchlist() {
  const {
    watchlist,
    crossoverEvents,
    selectedTicker,
    setSelectedTicker,
    addCustomStock,
  } = useQuantPulse();

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
    const cur = parseFloat(curVolInput) || 9.5;

    addCustomStock({
      ticker: sym,
      name: `${sym} Custom Ltd`,
      isFnO: segmentInput === 'FNO',
      lotSize: segmentInput === 'FNO' ? 250 : 1,
      strikeStep: spot > 1500 ? 50 : 20,
      spotLtp: spot,
      avgVol20DM: avg,
      todayVolM: cur,
      ivPct: segmentInput === 'FNO' ? 18.5 : 0,
    });

    setTickerInput('');
  };

  return (
    <section className="bg-panel rounded-xl border border-slate-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            Zone B: Watchlist &amp; Crossover Log
          </h2>
          <p className="text-[11px] text-slate-400">Add stocks &amp; track exact 20D crossover times</p>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
          {watchlist.length} Stocks
        </span>
      </div>

      {/* Add Custom Stock Form */}
      <form onSubmit={handleSubmit} className="p-3 border-b border-slate-800 bg-obsidian/50 space-y-2">
        <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
          <span>Add Stock to Volume Tracker</span>
          <span className="text-[10px] text-slate-400">Today vs 20D Vol</span>
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
          + Add Stock to 20D Volume Monitor
        </button>
      </form>

      {/* Pre-Market Automated 20D Baseline Sync Banner (Epic 2) */}
      <div className="px-3 py-2 bg-obsidian/90 border-b border-slate-800 flex items-center justify-between text-xs">
        <div>
          <div className="font-semibold text-white flex items-center gap-1.5">
            <span>🌅 09:00 AM Pre-Market Engine</span>
          </div>
          <div className="text-[10px] text-slate-400">Automated 20D Volume Baseline Job</div>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              const clientId = localStorage.getItem('qp_dhan_client_id') || '';
              const accessToken = localStorage.getItem('qp_dhan_access_token') || '';
              const res = await fetch('/api/pipeline/sync-baselines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, accessToken }),
              });
              const data = await res.json();
              if (data.success) {
                // update local state
                if (data.baselines) {
                  data.baselines.forEach((b: any) => {
                    const st = watchlist.find((s) => s.ticker === b.ticker);
                    if (st) st.avgVol20DM = b.avgVolume20DM;
                  });
                }
                alert(`Pre-market baseline sync completed! ${data.symbolsEvaluated} symbols updated via ${data.dataSource}.`);
              }
            } catch (err: any) {
              alert(`Sync failed: ${err.message}`);
            }
          }}
          className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition flex items-center gap-1"
          title="Manually trigger the 09:00 AM IST 20D baseline calculation job"
        >
          <span>⚡ Run 09:00 AM Sync</span>
        </button>
      </div>

      {/* Crossover Timestamp Event Log Title */}
      <div className="px-3 py-2 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
          <span>⏱️ Exact Crossover Timestamp Feed</span>
        </span>
        <span className="text-[10px] text-slate-400 font-mono">Immutable Latch</span>
      </div>

      {/* Crossover Event Stream Container */}
      <div className="p-2.5 flex-1 overflow-y-auto space-y-2 max-h-[340px]">
        {crossoverEvents.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            No stocks have crossed their 20-Day Average Volume yet.
          </div>
        ) : (
          crossoverEvents.map((ev, idx) => (
            <div
              key={`${ev.ticker}-${ev.time}-${idx}`}
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
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                    ELIGIBLE FOR BUY
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                  ⏱️ {ev.time} IST
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-mono">
                Crossed 20D Avg (<span className="text-white">{ev.avgVol20DM.toFixed(2)}M</span>) @ Spot{' '}
                <span className="text-emerald-300 font-semibold">₹{ev.crossPrice.toFixed(2)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Logic Summary Box */}
      <div className="p-3 bg-obsidian/90 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
        <div className="font-semibold text-slate-200">Core Eligibility Rule:</div>
        <div>
          • Track <span className="text-cyan-300 font-mono">Today_Vol</span> vs{' '}
          <span className="text-white font-mono">20D_Avg_Vol</span>
        </div>
        <div>
          • The instant <span className="text-emerald-400 font-mono">Today_Vol ≥ 20D_Avg_Vol</span>, latch exact{' '}
          <span className="text-amber-300 font-mono">HH:MM:SS</span> crossover time &amp; unlock{' '}
          <span className="text-emerald-300 font-semibold">ELIGIBLE FOR BUY</span>.
        </div>
      </div>
    </section>
  );
}
