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
          if (data && data.authenticated && data.user?.username) {
            setTerminalUser(data.user.username);
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
  }, [setTerminalUser]);

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
