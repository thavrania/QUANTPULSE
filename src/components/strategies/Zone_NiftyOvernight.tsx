'use client';

import React, { useState } from 'react';
import { NiftyOvernightState } from '@/lib/types/quant';

interface ZoneNiftyOvernightProps {
  strategyState: NiftyOvernightState;
  onExecuteSelection?: () => void;
  onAdjustPrice?: (type: 'CE' | 'PE', delta: number) => void;
  onForceStopLoss?: (type: 'CE' | 'PE') => void;
  onForceNextDayExit?: (isRecovery?: boolean) => void;
  onSimulateOvernightHold?: () => void;
  onResetScenario?: () => void;
}

export function Zone_NiftyOvernight({
  strategyState,
  onExecuteSelection,
  onAdjustPrice,
  onForceStopLoss,
  onForceNextDayExit,
  onSimulateOvernightHold,
  onResetScenario,
}: ZoneNiftyOvernightProps) {
  const { ceLeg, peLeg } = strategyState;
  const [showChainMatrix, setShowChainMatrix] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

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

  // Real-time Combined MTM Calculations
  const isSelected = ceLeg.refPrice > 0 && peLeg.refPrice > 0;
  const ceInvested = ceLeg.refPrice * ceLeg.quantity;
  const peInvested = peLeg.refPrice * peLeg.quantity;
  const totalInvested = ceInvested + peInvested;

  const ceCurrentVal = ceLeg.status === 'SL_HIT' || ceLeg.status === 'CLOSED'
    ? (ceLeg.exitPrice || ceLeg.stopLoss) * ceLeg.quantity
    : ceLeg.currentPrice * ceLeg.quantity;
  const peCurrentVal = peLeg.status === 'SL_HIT' || peLeg.status === 'CLOSED'
    ? (peLeg.exitPrice || peLeg.stopLoss) * peLeg.quantity
    : peLeg.currentPrice * peLeg.quantity;

  const totalCurrentVal = ceCurrentVal + peCurrentVal;
  const netMtmPnl = totalInvested > 0 ? +(totalCurrentVal - totalInvested).toFixed(2) : 0;
  const netMtmPct = totalInvested > 0 ? +((netMtmPnl / totalInvested) * 100).toFixed(2) : 0;

  // Maximum Risk is strictly capped at 25% of both legs
  const maxRiskCapital = totalInvested > 0 ? +(totalInvested * 0.25).toFixed(2) : 0;

  // Pre-configured Discovery Candidates
  const discoveryCandidates = [
    { type: 'CE', strike: 25000, price: 55.0, distance: 7.5, isWinner: ceLeg.strike === 25000 },
    { type: 'CE', strike: 25100, price: 61.0, distance: 1.5, isWinner: ceLeg.strike === 25100 },
    { type: 'CE', strike: 25200, price: 64.0, distance: 1.5, isWinner: ceLeg.strike === 25200 },
    { type: 'CE', strike: 25300, price: 72.0, distance: 9.5, isWinner: ceLeg.strike === 25300 },
    { type: 'PE', strike: 24700, price: 71.0, distance: 8.5, isWinner: peLeg.strike === 24700 },
    { type: 'PE', strike: 24800, price: 63.0, distance: 0.5, isWinner: peLeg.strike === 24800 },
    { type: 'PE', strike: 24900, price: 60.0, distance: 2.5, isWinner: peLeg.strike === 24900 },
    { type: 'PE', strike: 25000, price: 53.0, distance: 9.5, isWinner: peLeg.strike === 25000 },
  ];

  // Helper Scenarios
  const runScenarioBullishRally = () => {
    if (!isSelected) return;
    setIsSimulating(true);
    // CE surges to ₹84.50 (+32%), PE drops below SL to ₹38.00 (triggers SL!)
    onAdjustPrice?.('CE', +(84.5 - ceLeg.currentPrice));
    setTimeout(() => {
      onForceStopLoss?.('PE');
      setIsSimulating(false);
    }, 400);
  };

  const runScenarioBearishCrash = () => {
    if (!isSelected) return;
    setIsSimulating(true);
    // PE surges to ₹84.50 (+32%), CE drops below SL to ₹38.00 (triggers SL!)
    onAdjustPrice?.('PE', +(84.5 - peLeg.currentPrice));
    setTimeout(() => {
      onForceStopLoss?.('CE');
      setIsSimulating(false);
    }, 400);
  };

  const runScenarioThetaDecay = () => {
    if (!isSelected) return;
    // Both CE and PE decay mildly by -₹6.00 (both safe above SL)
    onAdjustPrice?.('CE', -6.0);
    onAdjustPrice?.('PE', -6.0);
  };

  const runScenarioNextDayExit = (type: 'GAP_UP' | 'FLAT' | 'GAP_DOWN') => {
    if (type === 'GAP_UP') {
      onAdjustPrice?.('CE', +(96.0 - ceLeg.currentPrice));
      onAdjustPrice?.('PE', +(24.0 - peLeg.currentPrice));
    } else if (type === 'FLAT') {
      onAdjustPrice?.('CE', +(48.0 - ceLeg.currentPrice));
      onAdjustPrice?.('PE', +(48.0 - peLeg.currentPrice));
    } else if (type === 'GAP_DOWN') {
      onAdjustPrice?.('CE', +(22.0 - ceLeg.currentPrice));
      onAdjustPrice?.('PE', +(98.0 - peLeg.currentPrice));
    }
    setTimeout(() => {
      onForceNextDayExit?.();
    }, 300);
  };

  return (
    <div className="space-y-4">
      {/* 1. MASTER SIMULATION HEADER & LIFECYCLE STEPPER */}
      <div className="bg-panel rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xl shadow-inner">
              🌙
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-tight">
                  NIFTY 09:20 Premium 62.5 Overnight Simulator
                </h2>
                <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded border ${getStatusBadgeVariant(strategyState.status)}`}>
                  {strategyState.status}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                  SIMULATION ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Strategy ID: <code className="text-cyan-300">{strategyState.dailyExecutionId}</code> • Telegram Sync: <span className="text-emerald-400">@SureShotTradeBot</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowChainMatrix(!showChainMatrix)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              {showChainMatrix ? 'Hide Discovery Chain' : '📊 View 09:20 Option Chain'}
            </button>
            <button
              type="button"
              onClick={onResetScenario}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition"
              title="Reset simulation back to blank pending selection"
            >
              🔄 Reset Scenario
            </button>
          </div>
        </div>

        {/* Core Invariant Banner */}
        <div className="bg-purple-950/40 border border-purple-500/30 rounded-xl p-3 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-purple-200">
            <span className="text-sm">🛡️</span>
            <span>
              <strong>CORE STRATEGY INVARIANT:</strong> Strictly <strong>NO TARGET PRICE</strong>. Only 2 exits exist:{' '}
              <strong className="text-rose-300">Intraday Stop Loss (25%)</strong> or{' '}
              <strong className="text-cyan-300">Next-Day 09:25 AM IST Mandatory Exit</strong>.
            </span>
          </div>
          <div className="text-[11px] font-mono text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
            15:35 Square-Off Bypassed (Overnight Hold)
          </div>
        </div>

        {/* 4-Step Interactive Timeline Stepper */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 font-mono text-xs">
          {/* Phase 1 */}
          <div className={`p-2.5 rounded-xl border ${
            strategyState.status === 'PENDING_SELECTION'
              ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-lg'
              : 'bg-slate-900/60 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold">PHASE 1</span>
              <span>09:20 AM</span>
            </div>
            <div className="font-bold text-white text-xs">Scan &amp; Lock ₹62.50</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Pick closest CE &amp; PE</div>
          </div>

          {/* Phase 2 */}
          <div className={`p-2.5 rounded-xl border ${
            strategyState.status === 'ACTIVE'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-lg'
              : 'bg-slate-900/60 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold">PHASE 2</span>
              <span>09:20 - 15:30</span>
            </div>
            <div className="font-bold text-white text-xs">Intraday 25% SL Watch</div>
            <div className="text-[10px] text-slate-400 mt-0.5">SL Hit → Sell Immediately</div>
          </div>

          {/* Phase 3 */}
          <div className={`p-2.5 rounded-xl border ${
            strategyState.status === 'OVERNIGHT_HOLD'
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-lg'
              : 'bg-slate-900/60 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold">PHASE 3</span>
              <span>15:30 PM</span>
            </div>
            <div className="font-bold text-white text-xs">Overnight Carry</div>
            <div className="text-[10px] text-slate-400 mt-0.5">15:35 Square-off Bypassed</div>
          </div>

          {/* Phase 4 */}
          <div className={`p-2.5 rounded-xl border ${
            strategyState.status === 'NEXT_DAY_0925_EXIT' || strategyState.status === 'NEXT_DAY_0925_EXIT_RECOVERY' || strategyState.status === 'CLOSED'
              ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-lg'
              : 'bg-slate-900/60 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold">PHASE 4</span>
              <span>09:25 AM (+1D)</span>
            </div>
            <div className="font-bold text-white text-xs">Mandatory Exit</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Sell remaining positions</div>
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE SIMULATION CONTROL STUDIO */}
      <div className="bg-panel rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🕹️</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Simulation Scenario Control Studio
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Execute actions below to test each phase &amp; watch Telegram alerts
          </span>
        </div>

        {/* Step-by-Step Scenario Trigger Bar */}
        <div className="space-y-3">
          {/* Action Row 1: Selection & Fast Market Scenarios */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onExecuteSelection}
              disabled={strategyState.status === 'ACTIVE' || strategyState.status === 'OVERNIGHT_HOLD'}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 transition flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
            >
              <span>⚡</span> Step 1: Run 09:20 Scan &amp; Lock Straddle
            </button>

            {isSelected && (
              <>
                <button
                  type="button"
                  onClick={runScenarioBullishRally}
                  disabled={isSimulating || strategyState.status === 'CLOSED'}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition flex items-center gap-1"
                  title="Simulate +200 pt rally: CE climbs to ₹84.50, PE drops below SL (SL exit)"
                >
                  <span>📈</span> Scenario A: Bullish Rally (+35% CE / PE SL Breach)
                </button>

                <button
                  type="button"
                  onClick={runScenarioBearishCrash}
                  disabled={isSimulating || strategyState.status === 'CLOSED'}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition flex items-center gap-1"
                  title="Simulate -200 pt drop: PE climbs to ₹84.50, CE drops below SL (SL exit)"
                >
                  <span>📉</span> Scenario B: Bearish Crash (+35% PE / CE SL Breach)
                </button>

                <button
                  type="button"
                  onClick={runScenarioThetaDecay}
                  disabled={isSimulating || strategyState.status === 'CLOSED'}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition flex items-center gap-1"
                  title="Simulate theta decay: both premiums decay mildly, both safe for overnight carry"
                >
                  <span>⏳</span> Scenario C: Theta Decay (-10% Both / Carry)
                </button>
              </>
            )}
          </div>

          {/* Action Row 2: Overnight & Next-Day Mandatory Exit */}
          {isSelected && (
            <div className="p-3 bg-obsidian rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-300">Phase 3 &amp; 4 Actions:</span>
                <button
                  type="button"
                  onClick={onSimulateOvernightHold}
                  disabled={strategyState.status === 'OVERNIGHT_HOLD' || strategyState.status === 'CLOSED'}
                  className="px-3 py-1.5 rounded-lg font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition"
                  title="Simulate 15:30 close: bypass 15:35 intraday squareoff and hold overnight"
                >
                  🌙 Simulate 15:30 Overnight Hold
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 font-mono">Next-Day 09:25 Exits:</span>
                <button
                  type="button"
                  onClick={() => runScenarioNextDayExit('GAP_UP')}
                  className="px-2.5 py-1.5 rounded-lg font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition"
                  title="Simulate next-day 09:25 AM exit on Gap Up (CE: ₹96, PE: ₹24)"
                >
                  🟢 Gap Up Exit
                </button>
                <button
                  type="button"
                  onClick={() => runScenarioNextDayExit('FLAT')}
                  className="px-2.5 py-1.5 rounded-lg font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  title="Simulate next-day 09:25 AM exit on Flat open (CE: ₹48, PE: ₹48)"
                >
                  ⚪ Flat Decay Exit
                </button>
                <button
                  type="button"
                  onClick={() => runScenarioNextDayExit('GAP_DOWN')}
                  className="px-2.5 py-1.5 rounded-lg font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition"
                  title="Simulate next-day 09:25 AM exit on Gap Down (CE: ₹22, PE: ₹98)"
                >
                  🔴 Gap Down Exit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. OPTION CHAIN DISCOVERY MATRIX (COLLAPSIBLE) */}
      {showChainMatrix && (
        <div className="bg-panel rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                09:20 AM Option Chain Discovery Matrix (₹50 to ₹75 Range)
              </h3>
              <p className="text-[11px] text-slate-400">
                Engine evaluates all strikes between ₹50 and ₹75 and strictly picks the contract closest to ideal ₹62.50
              </p>
            </div>
            <span className="text-xs font-mono text-amber-300">
              Target Expiry: {strategyState.selectedExpiry}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2">Type</th>
                  <th className="p-2">Strike</th>
                  <th className="p-2">09:20 Price</th>
                  <th className="p-2">Distance from ₹62.50</th>
                  <th className="p-2">Eligible (₹50-₹75)</th>
                  <th className="p-2 text-right">Selection Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {discoveryCandidates.map((c) => (
                  <tr key={`${c.type}_${c.strike}`} className={c.isWinner ? 'bg-purple-500/10 font-bold' : ''}>
                    <td className={`p-2 ${c.type === 'CE' ? 'text-cyan-400' : 'text-purple-400'}`}>{c.type}</td>
                    <td className="p-2 text-white">NIFTY {c.strike}</td>
                    <td className="p-2 text-white">₹{c.price.toFixed(2)}</td>
                    <td className="p-2 text-slate-300">{c.distance.toFixed(2)} pts</td>
                    <td className="p-2 text-emerald-400">YES (Within Range)</td>
                    <td className="p-2 text-right">
                      {c.isWinner ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]">
                          ✓ SELECTED (Closest)
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Runner Up</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. LIVE COMBINED STRADDLE DASHBOARD & NET P&L */}
      {isSelected && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total Capital */}
          <div className="p-3.5 rounded-xl bg-panel border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-mono uppercase">Initial Investment (1 Lot)</span>
            <div className="text-base font-bold text-white font-mono">
              ₹{totalInvested.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-400">
              CE ₹{ceInvested.toFixed(0)} + PE ₹{peInvested.toFixed(0)}
            </div>
          </div>

          {/* Current Value */}
          <div className="p-3.5 rounded-xl bg-panel border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-mono uppercase">Current Straddle Value</span>
            <div className="text-base font-bold text-cyan-300 font-mono">
              ₹{totalCurrentVal.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-400">
              CE ₹{ceCurrentVal.toFixed(0)} + PE ₹{peCurrentVal.toFixed(0)}
            </div>
          </div>

          {/* Net MTM P&L */}
          <div className={`p-3.5 rounded-xl border space-y-1 ${
            netMtmPnl >= 0
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-rose-500/10 border-rose-500/30'
          }`}>
            <span className="text-[10px] text-slate-300 font-mono uppercase">Combined MTM P&amp;L</span>
            <div className={`text-base font-bold font-mono ${netMtmPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {netMtmPnl >= 0 ? '+' : ''}₹{netMtmPnl.toLocaleString('en-IN')} ({netMtmPct >= 0 ? '+' : ''}{netMtmPct}%)
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {netMtmPnl >= 0 ? '🟢 In Profit' : '🔴 Drawdown'}
            </div>
          </div>

          {/* Max Risk Cap */}
          <div className="p-3.5 rounded-xl bg-panel border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-mono uppercase">Hard Max Risk (25% SL)</span>
            <div className="text-base font-bold text-rose-300 font-mono">
              -₹{maxRiskCapital.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-400">
              Guaranteed Risk Capped at 25%
            </div>
          </div>
        </div>
      )}

      {/* 5. CE & PE INTERACTIVE ACTIVE LEG CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CE CARD */}
        <div className="bg-panel rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400"></span>
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
              <span className="text-slate-400">Contract:</span>
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

            <div className="flex items-center justify-between p-2 rounded bg-rose-500/10 border border-rose-500/30">
              <span className="text-rose-300 font-bold">Fixed Stop Loss (25%):</span>
              <span className="font-bold text-rose-400 text-sm">
                {ceLeg.stopLoss > 0 ? `₹${ceLeg.stopLoss.toFixed(2)}` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Current Simulated Price:</span>
              <span className="font-bold text-emerald-400 text-sm">
                {ceLeg.currentPrice > 0 ? `₹${ceLeg.currentPrice.toFixed(2)}` : '—'}
              </span>
            </div>

            {/* Progress to SL */}
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

            {/* Interactive Manual Steppers & SL Breaker */}
            {ceLeg.refPrice > 0 && ceLeg.status !== 'SL_HIT' && ceLeg.status !== 'CLOSED' && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Simulate CE Price:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onAdjustPrice?.('CE', 1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                  >
                    +₹1
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdjustPrice?.('CE', 5)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold"
                  >
                    +₹5
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdjustPrice?.('CE', -1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                  >
                    -₹1
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdjustPrice?.('CE', -5)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-bold"
                  >
                    -₹5
                  </button>
                  <button
                    type="button"
                    onClick={() => onForceStopLoss?.('CE')}
                    className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold ml-auto"
                  >
                    🚨 Trigger SL Hit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PE CARD */}
        <div className="bg-panel rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-400 shadow-sm shadow-purple-400"></span>
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
              <span className="text-slate-400">Contract:</span>
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

            <div className="flex items-center justify-between p-2 rounded bg-rose-500/10 border border-rose-500/30">
              <span className="text-rose-300 font-bold">Fixed Stop Loss (25%):</span>
              <span className="font-bold text-rose-400 text-sm">
                {peLeg.stopLoss > 0 ? `₹${peLeg.stopLoss.toFixed(2)}` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Current Simulated Price:</span>
              <span className="font-bold text-emerald-400 text-sm">
                {peLeg.currentPrice > 0 ? `₹${peLeg.currentPrice.toFixed(2)}` : '—'}
              </span>
            </div>

            {/* Progress to SL */}
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

            {/* Interactive Manual Steppers & SL Breaker */}
            {peLeg.refPrice > 0 && peLeg.status !== 'SL_HIT' && peLeg.status !== 'CLOSED' && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Simulate PE Price:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onAdjustPrice?.('PE', 1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                  >
                    +₹1
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdjustPrice?.('PE', 5)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold"
                  >
                    +₹5
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdjustPrice?.('PE', -1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                  >
                    -₹1
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdjustPrice?.('PE', -5)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-bold"
                  >
                    -₹5
                  </button>
                  <button
                    type="button"
                    onClick={() => onForceStopLoss?.('PE')}
                    className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold ml-auto"
                  >
                    🚨 Trigger SL Hit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. AFTER-EXIT PERFORMANCE & REALIZED P&L LEDGER */}
      {(ceLeg.exitPrice || peLeg.exitPrice) && (
        <div className="bg-panel rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Simulation Realized Outcome &amp; Trade Audit
            </h3>
            <span className="text-[11px] font-mono text-cyan-300">Strategy Lifecycle Completed</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2">Leg</th>
                  <th className="p-2">Symbol</th>
                  <th className="p-2">09:20 Ref</th>
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
