'use client';

import React from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { buildNextActionPayload } from '@/lib/engine/optionPricing';

export function JsonPayloadModal() {
  const {
    watchlist,
    selectedTicker,
    config,
    isJsonModalOpen,
    setIsJsonModalOpen,
  } = useQuantPulse();

  if (!isJsonModalOpen) return null;

  const stock = watchlist.find((s) => s.ticker === selectedTicker) || watchlist[0];
  const payload = stock ? buildNextActionPayload(stock, config) : {};

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panel border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-cyan-400 font-bold">&#123; &#125;</span>
            <div>
              <h3 className="text-sm font-bold text-white">Live QuantPulse Engine JSON State</h3>
              <p className="text-xs text-slate-400">
                Auditing payload for <span className="text-cyan-300 font-mono">{stock?.ticker}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsJsonModalOpen(false)}
            className="text-slate-400 hover:text-white text-sm px-2.5 py-1 rounded bg-slate-800"
          >
            ✕ Close
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 bg-obsidian">
          <pre className="font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs text-slate-400">
          <span>Formatted for Institutional Order Dispatch APIs</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition"
          >
            📋 Copy JSON
          </button>
        </div>
      </div>
    </div>
  );
}
