'use client';

import React from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { AutoPilotStepId } from '@/lib/services/preMarketAutoPilotService';

export function PreMarketAutoPilotModal() {
  const {
    autoPilotStatus,
    isAutoPilotModalOpen,
    setIsAutoPilotModalOpen,
    toggleAutoPilot,
    runAutoPilotStepNow,
    isLiveStreaming,
  } = useQuantPulse();

  if (!isAutoPilotModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-panel border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/35 flex items-center justify-center text-lg">
              🤖
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Pre-Market Auto-Pilot</h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    autoPilotStatus.enabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {autoPilotStatus.enabled ? 'ACTIVE' : 'PAUSED'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated 4-Step Pre-Market Preparation Sequence (09:00 – 09:15 IST)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle Switch */}
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-slate-300 font-semibold">Auto-Pilot</span>
              <button
                type="button"
                onClick={toggleAutoPilot}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoPilotStatus.enabled ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoPilotStatus.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            <button
              type="button"
              onClick={() => setIsAutoPilotModalOpen(false)}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Status Bar */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Next Action</span>
              <div className="text-sm font-bold text-white mt-0.5 flex items-center gap-2">
                <span>{autoPilotStatus.nextStepName}</span>
                {autoPilotStatus.countdownFormatted && (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/35">
                    ⏱️ {autoPilotStatus.countdownFormatted}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Market Open</span>
              <div className="text-xs font-mono font-semibold text-emerald-400 mt-0.5">
                09:15:00 AM IST
              </div>
            </div>
          </div>

          {/* 4-Step Pipeline Cards */}
          <div className="space-y-2.5">
            {autoPilotStatus.steps.map((step, idx) => {
              const isCurrent = autoPilotStatus.currentStepIndex === idx && !step.completed;
              return (
                <div
                  key={step.id}
                  className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                    step.completed
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : isCurrent
                      ? 'bg-cyan-950/25 border-cyan-500/40 ring-1 ring-cyan-500/30'
                      : 'bg-obsidian/60 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        step.completed
                          ? 'bg-emerald-500 text-slate-950'
                          : isCurrent
                          ? 'bg-cyan-500 text-slate-950 animate-pulse'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {step.completed ? '✓' : idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-white">{step.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                          {step.targetTime}
                        </span>
                        {step.completed ? (
                          <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                            ✅ Done ({step.completedAt || 'Today'})
                          </span>
                        ) : step.isRunning ? (
                          <span className="text-[10px] font-mono text-cyan-300 font-semibold animate-pulse">
                            ⏳ Running now...
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">
                            ⏳ Pending
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={step.isRunning}
                    onClick={() => runAutoPilotStepNow(step.id as AutoPilotStepId)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition shrink-0 ${
                      step.completed
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'
                    }`}
                  >
                    {step.isRunning ? 'Running...' : step.completed ? 'Re-run' : 'Run Now'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* NSE Market Session Technical Architecture Note */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <span>🏛️ NSE / BSE Market Mechanics (How it Works)</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-400 font-sans">
              <li>
                <strong className="text-slate-300">09:00 – 09:08 AM IST (Pre-Open)</strong>: Orders are placed and modified. At 09:07–09:08 AM, the official opening equilibrium price is computed.
              </li>
              <li>
                <strong className="text-slate-300">09:08 – 09:12 AM IST (Price Discovery)</strong>: Opening prices are finalized. Live Sync catches these values to calibrate ATM Call/CE strikes for Options.
              </li>
              <li>
                <strong className="text-slate-300">09:14:30 AM IST (Feed Armed)</strong>: Auto-Pilot connects the live WebSocket/quote stream 30 seconds ahead of market open so you never miss 09:15:00 AM crossovers.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/70 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <span>Automated Telegram notifications:</span>
            <span className="text-emerald-400 font-semibold">ACTIVE</span>
          </div>
          <button
            type="button"
            onClick={() => setIsAutoPilotModalOpen(false)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
