'use client';

import React, { useState, useEffect } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { LoginGate } from '@/components/auth/LoginGate';
import { ZoneA_Header } from '@/components/zones/ZoneA_Header';
import { ZoneB_Watchlist } from '@/components/zones/ZoneB_Watchlist';
import { ZoneC_Screener } from '@/components/zones/ZoneC_Screener';
import { ZoneD_NextAction } from '@/components/zones/ZoneD_NextAction';
import { ZoneE_Positions } from '@/components/zones/ZoneE_Positions';
import { Zone_NiftyOvernight } from '@/components/strategies/Zone_NiftyOvernight';
import { Zone_NiftyBreakout180 } from '@/components/strategies/breakout180/Zone_NiftyBreakout180';

export default function QuantPulseTerminalPage() {
  const {
    terminalUser,
    setTerminalUser,
    isSessionRemotelyKilled,
    setIsSessionRemotelyKilled,
    remoteKillReason,
    setActiveSessionsCount,
    activeStrategy,
    niftyOvernightState,
    executeNifty0920Scan,
    adjustNiftyLegPrice,
    forceNiftyStopLoss,
    forceNiftyNextDayExit,
    simulateOvernightHold,
    resetNiftyScenario,
  } = useQuantPulse();

  const [isVerifyingSession, setIsVerifyingSession] = useState(true);

  // Validate active terminal session on mount
  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (isMounted) {
          if (data && data.killed) {
            setIsSessionRemotelyKilled(true);
            setTerminalUser(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('qp_terminal_user');
            }
          } else if (data && data.authenticated && data.user?.username) {
            setTerminalUser(data.user.username);
            if (typeof data.activeSessionsCount === 'number') {
              setActiveSessionsCount(data.activeSessionsCount);
            }
          } else {
            setTerminalUser(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('qp_terminal_user');
            }
          }
        }
      } catch (err) {
        console.warn('Session check exception:', err);
        if (isMounted) setTerminalUser(null);
      } finally {
        if (isMounted) setIsVerifyingSession(false);
      }
    }
    checkSession();
    return () => {
      isMounted = false;
    };
  }, [setTerminalUser, setIsSessionRemotelyKilled, setActiveSessionsCount]);

  // Loading state while verifying terminal session
  if (isVerifyingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shadow-lg shadow-cyan-500/20" />
          <div className="font-mono text-xs text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Verifying QuantPulse Terminal Session...</span>
          </div>
        </div>
      </div>
    );
  }

  // If this session was terminated remotely from another device, show Lockdown screen
  if (isSessionRemotelyKilled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian text-slate-100 p-4">
        <div className="bg-panel border border-rose-500/50 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-rose-950/60 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto mb-4 text-3xl text-rose-400 shadow-lg shadow-rose-500/20">
            🚫
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Browser Session Terminated</h2>
          <p className="text-xs text-rose-300 font-mono mb-4 px-3 py-2 rounded-lg bg-rose-950/40 border border-rose-900/50">
            {remoteKillReason || 'This browser session was killed remotely by the administrator.'}
          </p>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            All live market feeds, order execution capabilities, and real-time streams have been immediately disconnected for this workstation.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.close();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-rose-950/50 cursor-pointer"
            >
              Close Browser Tab
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSessionRemotelyKilled(false);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition border border-slate-700 cursor-pointer"
            >
              Log In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If user is not authenticated, strictly show the Login Gate
  if (!terminalUser) {
    return <LoginGate onLoginSuccess={(u) => setTerminalUser(u)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-obsidian text-slate-100">
      {/* ZONE A: GLOBAL COMMAND & MASTER TOGGLES */}
      <ZoneA_Header />

      {/* MAIN WORKSPACE: DYNAMIC STRATEGY RENDER */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-3">
        {activeStrategy === 'NIFTY_BREAKOUT_180' ? (
          /* STRATEGY 3: NIFTY 09:30 ₹180 BREAKOUT BACKTESTING WORKSPACE */
          <div className="w-full">
            <Zone_NiftyBreakout180 />
          </div>
        ) : activeStrategy === 'NIFTY_OVERNIGHT' ? (
          /* STRATEGY 2: NIFTY 09:20 PREMIUM 62.5 OVERNIGHT WORKSPACE */
          <div className="w-full">
            <Zone_NiftyOvernight
              strategyState={niftyOvernightState}
              onExecuteSelection={executeNifty0920Scan}
              onAdjustPrice={adjustNiftyLegPrice}
              onForceStopLoss={forceNiftyStopLoss}
              onForceNextDayExit={forceNiftyNextDayExit}
              onSimulateOvernightHold={simulateOvernightHold}
              onResetScenario={resetNiftyScenario}
            />
          </div>
        ) : (
          /* STRATEGY 1: 20-DAY VOLUME CROSSOVER WORKSPACE (ZONES B, C, D) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* ZONE B: WATCHLIST & CROSSOVER FEED (3 COLS) */}
            <div className="lg:col-span-3">
              <ZoneB_Watchlist />
            </div>

            {/* ZONE C: 20-DAY VOLUME CROSSOVER SCREENER (6 COLS) */}
            <div className="lg:col-span-6">
              <ZoneC_Screener />
            </div>

            {/* ZONE D: DYNAMIC NEXT-ACTION CARD (3 COLS) */}
            <div className="lg:col-span-3">
              <ZoneD_NextAction />
            </div>
          </div>
        )}
      </main>

      {/* ZONE E: EXECUTED TRADES & TRAILING STOP-LOSS (TSL) MONITOR */}
      {activeStrategy !== 'NIFTY_BREAKOUT_180' && <ZoneE_Positions />}

      {/* Institutional Terminal Footer */}
      <footer className="border-t border-slate-900 bg-obsidian/90 px-4 py-3 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-400">QuantPulse Enterprise v1.0.0</span>
          <span>•</span>
          <span>Next.js 14 App Router + Supabase PostgreSQL Engine</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>Engine Status: <strong className="text-emerald-400">NOMINAL</strong></span>
          <span>Latency: <strong className="text-cyan-400 font-mono">&lt; 15ms</strong></span>
          <span>Risk Guardrails: <strong className="text-amber-400">ACTIVE</strong></span>
        </div>
      </footer>
    </div>
  );
}
