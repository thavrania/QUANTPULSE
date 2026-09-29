'use client';

import React, { useState, useEffect } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { buildOptionChainMatrix, OptionChainSummary, OptionStrikeRow } from '@/lib/engine/optionChainEngine';

export function OptionChainModal() {
  const {
    watchlist,
    selectedTicker,
    isOptionChainModalOpen,
    setIsOptionChainModalOpen,
  } = useQuantPulse();

  const [chainData, setChainData] = useState<OptionChainSummary | null>(null);

  const stock = watchlist.find((s) => s.ticker === selectedTicker) || watchlist[0];

  useEffect(() => {
    if (!isOptionChainModalOpen || !stock) return;

    // Build chain matrix
    const matrix = buildOptionChainMatrix(
      stock.ticker,
      stock.spotLtp,
      stock.strikeStep,
      stock.ivPct || 18.5
    );
    setChainData(matrix);
  }, [isOptionChainModalOpen, stock, stock?.spotLtp]);

  if (!isOptionChainModalOpen || !stock || !chainData) return null;

  const onClose = () => setIsOptionChainModalOpen(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-panel border border-slate-700 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-sm">
              📊
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">NSE Live Option Chain Matrix</h3>
                <span className="text-xs font-mono font-bold text-cyan-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {chainData.underlying} Spot: ₹{chainData.spotPrice.toFixed(2)}
                </span>
                <span className="text-[10px] font-mono uppercase bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                  Expiry: {chainData.expiryDate} ({chainData.daysToExpiry}d)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Black-Scholes Greeks • Open Interest Build-up • Real-Time Strike Resolution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* PCR Ratio Badge */}
            <div className="bg-obsidian px-3 py-1 rounded-lg border border-slate-800 text-right">
              <div className="text-[9px] uppercase text-slate-400">Put-Call Ratio (PCR)</div>
              <div
                className={`text-xs font-mono font-bold ${
                  chainData.pcrRatio > 1.0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {chainData.pcrRatio}{' '}
                <span className="text-[9px] font-normal text-slate-400">
                  {chainData.pcrRatio > 1.2
                    ? '(Bullish)'
                    : chainData.pcrRatio < 0.8
                    ? '(Bearish)'
                    : '(Neutral)'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white text-sm px-2.5 py-1 rounded bg-slate-800"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Option Chain Table */}
        <div className="p-4 flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase font-semibold text-slate-400 bg-obsidian/80">
                <th colSpan={5} className="py-2 px-3 text-center text-emerald-400 border-r border-slate-800">
                  CALL OPTIONS (CE)
                </th>
                <th className="py-2 px-3 text-center text-white bg-slate-800/80">STRIKE</th>
                <th colSpan={2} className="py-2 px-3 text-center text-rose-400 border-l border-slate-800">
                  PUT OPTIONS (PE)
                </th>
              </tr>
              <tr className="border-b border-slate-800 text-[9px] uppercase tracking-wider text-slate-400 bg-obsidian/40">
                <th className="py-1.5 px-2">OI (Lots)</th>
                <th className="py-1.5 px-2">Delta</th>
                <th className="py-1.5 px-2">Theta</th>
                <th className="py-1.5 px-2">IV %</th>
                <th className="py-1.5 px-2 text-right border-r border-slate-800">Call LTP</th>
                <th className="py-1.5 px-3 text-center bg-slate-800/50">Strike Price</th>
                <th className="py-1.5 px-3 border-l border-slate-800">Put LTP</th>
                <th className="py-1.5 px-2 text-right">Put OI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono text-xs">
              {chainData.strikes.map((row) => {
                const isAtm = row.moneyness === 'ATM';

                return (
                  <tr
                    key={row.strikePrice}
                    onClick={() => {
                      onClose();
                    }}
                    className={`cursor-pointer transition ${
                      isAtm
                        ? 'bg-amber-500/10 font-bold hover:bg-amber-500/20'
                        : row.moneyness === 'ITM'
                        ? 'bg-emerald-950/20 hover:bg-emerald-950/40'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    {/* Call OI */}
                    <td className="py-2 px-2 text-slate-300">
                      <div>{(row.callOi / 1000).toFixed(0)}k</div>
                      <div
                        className={`text-[9px] ${
                          row.callOiChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {row.callOiChange >= 0 ? '+' : ''}
                        {(row.callOiChange / 1000).toFixed(1)}k
                      </div>
                    </td>

                    {/* Delta */}
                    <td className="py-2 px-2 text-cyan-300 font-semibold">{row.callGreeks.delta}</td>

                    {/* Theta */}
                    <td className="py-2 px-2 text-rose-300">₹{row.callGreeks.theta}</td>

                    {/* IV % */}
                    <td className="py-2 px-2 text-slate-300">{row.callIvPct}%</td>

                    {/* Call LTP */}
                    <td className="py-2 px-2 text-right font-bold text-emerald-400 border-r border-slate-800">
                      ₹{row.callLtp.toFixed(2)}
                    </td>

                    {/* Center Strike Price */}
                    <td
                      className={`py-2 px-3 text-center font-bold ${
                        isAtm
                          ? 'text-amber-300 bg-amber-500/20 border-x border-amber-500/40 shadow-inner'
                          : 'text-white bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>{row.strikePrice}</span>
                        {isAtm && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-bold uppercase">
                            ATM
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Put LTP */}
                    <td className="py-2 px-3 text-slate-200 border-l border-slate-800">
                      ₹{row.putLtp.toFixed(2)}
                    </td>

                    {/* Put OI */}
                    <td className="py-2 px-2 text-right text-slate-400">
                      {(row.putOi / 1000).toFixed(0)}k
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Guidance */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block"></span>
              <strong>ATM:</strong> Highest Gamma &amp; Delta ~0.50
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-800 inline-block"></span>
              <strong>ITM:</strong> High Delta (0.60 - 0.85)
            </span>
            <span className="text-[11px] text-slate-400">Click any row to select contract for Zone D execution</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  );
}
