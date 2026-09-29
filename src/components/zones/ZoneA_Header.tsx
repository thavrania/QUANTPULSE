'use client';

import React from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';

export function ZoneA_Header() {
  const {
    config,
    clockTime,
    totalMtmPnl,
    isLiveStreaming,
    isSupabaseActive,
    feedMode,
    setFeedMode,
    lastLiveSyncTime,
    isLiveFetching,
    fetchLiveDhanQuotes,
    refreshLiveQuotesNow,
    setInstrumentMode,
    setExecutionMode,
    setCapitalPerTrade,
    toggleLiveStream,
    simulateSingleTick,
    resetSimulation,
    panicKillSwitch,
    setIsJsonModalOpen,
    setIsAddStockModalOpen,
    setIsBrokerModalOpen,
    setIsAlertsModalOpen,
    setIsAuthModalOpen,
  } = useQuantPulse();

  return (
    <header className="sticky top-0 z-30 bg-panel/95 backdrop-blur border-b border-slate-800 px-3 py-2.5 shadow-xl">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-2.5">
        
        {/* Brand & Market Clock */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center shadow-inner">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-sm md:text-base text-white">QUANTPULSE</span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                20D Volume Crossover Engine
              </span>
              {isSupabaseActive ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                  Supabase Live DB
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-semibold">
                  Local High-Perf Sim
                </span>
              )}
              {lastLiveSyncTime && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Dhan Sync: {lastLiveSyncTime}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Market Clock:</span>
              <span className="font-mono font-bold text-cyan-300">{clockTime} IST</span>
            </div>
          </div>
        </div>

        {/* Master Toggles (Instrument, Trade Mode & Feed Source) */}
        <div className="flex flex-wrap items-center gap-2.5 bg-obsidian/90 p-1.5 rounded-xl border border-slate-800">
          
          {/* Toggle 1: Stock vs Option */}
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-900/90 border border-slate-800/80">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Action:
            </div>
            <div className="inline-flex items-center h-7 rounded-lg p-0.5 border border-slate-700 bg-slate-800">
              <button
                type="button"
                onClick={() => setInstrumentMode('STOCK')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  config.instrumentMode === 'STOCK'
                    ? 'bg-cyan-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                BUY STOCK (EQ)
              </button>
              <button
                type="button"
                onClick={() => setInstrumentMode('OPTION')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  config.instrumentMode === 'OPTION'
                    ? 'bg-purple-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                BUY OPTION (ATM CE)
              </button>
            </div>
          </div>

          {/* Toggle 2: Manual vs Auto Trade */}
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-900/90 border border-slate-800/80">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Trade Mode:
            </div>
            <div className="inline-flex items-center h-7 rounded-lg p-0.5 border border-slate-700 bg-slate-800">
              <button
                type="button"
                onClick={() => setExecutionMode('MANUAL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  config.executionMode === 'MANUAL'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                MANUAL
              </button>
              <button
                type="button"
                onClick={() => setExecutionMode('AUTO')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  config.executionMode === 'AUTO'
                    ? 'bg-emerald-400 text-slate-950 shadow animate-pulse'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                AUTO TRADE
              </button>
            </div>
          </div>

          {/* Toggle 3: Live Dhan Feed vs Simulation */}
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-900/90 border border-slate-800/80">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Feed:
            </div>
            <div className="inline-flex items-center h-7 rounded-lg p-0.5 border border-slate-700 bg-slate-800">
              <button
                type="button"
                onClick={() => setFeedMode('DHAN_LIVE')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  feedMode === 'DHAN_LIVE'
                    ? 'bg-rose-500 text-white shadow font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Direct Live Market Feed from Dhan HQ Open API v2"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${feedMode === 'DHAN_LIVE' ? 'bg-white animate-pulse' : 'bg-rose-400'}`}></span>
                LIVE DHAN
              </button>
              <button
                type="button"
                onClick={() => setFeedMode('SIMULATION')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  feedMode === 'SIMULATION'
                    ? 'bg-emerald-400 text-slate-950 shadow font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Deterministic Tick Simulator (Testing & Weekend Replay)"
              >
                SIMULATOR
              </button>
            </div>
          </div>
        </div>

        {/* Capital, MTM P&L, Simulator Controls & Kill Switch */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Capital Input */}
          <div className="bg-obsidian px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5">
            <span className="text-[10px] uppercase text-slate-400 font-semibold">Cap/Trade ₹</span>
            <input
              type="number"
              value={config.capitalPerTrade}
              step={10000}
              min={10000}
              onChange={(e) => setCapitalPerTrade(parseFloat(e.target.value) || 10000)}
              className="w-24 bg-slate-900 text-xs font-mono text-emerald-300 px-2 py-0.5 rounded border border-slate-700 focus:outline-none"
            />
          </div>

          {/* Live MTM P&L */}
          <div className="bg-obsidian px-3 py-1 rounded-lg border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400">Daily MTM P&amp;L</div>
            <div
              className={`text-xs font-mono font-bold ${
                totalMtmPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalMtmPnl >= 0 ? '+' : ''}₹
              {totalMtmPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Feed & Stream Actions */}
          <div className="flex items-center gap-1.5">
            {feedMode === 'DHAN_LIVE' ? (
              <button
                type="button"
                onClick={refreshLiveQuotesNow}
                disabled={isLiveFetching}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition flex items-center gap-1.5"
                title="Fetch latest live market quotes for all symbols from Dhan HQ"
              >
                <span className={isLiveFetching ? 'animate-spin' : ''}>🔄</span>
                <span>{isLiveFetching ? 'Syncing...' : 'Live Sync'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={simulateSingleTick}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition"
                title="Advance 1 Volume & Price Tick across all stocks"
              >
                + Boost Vol Tick
              </button>
            )}

            <button
              type="button"
              onClick={toggleLiveStream}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                isLiveStreaming
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveStreaming ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`}></span>
              <span>{isLiveStreaming ? '⏸ Pause Stream' : feedMode === 'DHAN_LIVE' ? '▶ Start Live Feed' : '▶ Start Vol Stream'}</span>
            </button>

            {feedMode === 'SIMULATION' && (
              <button
                type="button"
                onClick={resetSimulation}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                title="Reset simulation states"
              >
                ↺ Reset
              </button>
            )}
          </div>

          {/* Panic Kill Switch */}
          <button
            type="button"
            onClick={panicKillSwitch}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition"
            title="Turn OFF Auto Mode and square off all open positions"
          >
            🛑 KILL SWITCH
          </button>

          {/* Modals & Inspection Buttons */}
          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
            <button
              type="button"
              onClick={() => setIsBrokerModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1"
              title="Configure Dhan HQ or Broker Gateway"
            >
              <span>🔌 Broker: Dhan HQ</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAlertsModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition flex items-center gap-1"
              title="Configure Telegram Bot Webhook Alerts"
            >
              <span>🔔 Alerts</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1"
              title="Supabase User Profile & Authentication"
            >
              <span>👤 Account</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAddStockModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition"
            >
              + Add Ticker
            </button>
            <button
              type="button"
              onClick={() => setIsJsonModalOpen(true)}
              className="px-2 py-1.5 rounded-lg text-xs font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition"
              title="Inspect Current JSON State"
            >
              &#123; &#125;
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
