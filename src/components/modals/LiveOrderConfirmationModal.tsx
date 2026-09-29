'use client';

import React from 'react';

export interface OrderPreviewDetails {
  ticker: string;
  symbol: string;
  instrumentType: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  lots?: number | null;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  capitalRequired: number;
  isPaper: boolean;
}

interface LiveOrderConfirmationModalProps {
  isOpen: boolean;
  order: OrderPreviewDetails | null;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LiveOrderConfirmationModal({
  isOpen,
  order,
  isSubmitting,
  onConfirm,
  onCancel,
}: LiveOrderConfirmationModalProps) {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panel border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            order.isPaper
              ? 'bg-cyan-950/40 border-cyan-500/30'
              : 'bg-rose-950/40 border-rose-500/30'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{order.isPaper ? '📝' : '⚡'}</span>
            <div>
              <h3 className="text-sm font-bold text-white">
                {order.isPaper ? 'Confirm Paper Order Dispatch' : 'CONFIRM LIVE DHAN ORDER'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {order.isPaper
                  ? 'Simulated Order (Zero Capital Risk)'
                  : 'Real Capital Will Be Dispatched to Exchange!'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-white text-sm px-2.5 py-1 rounded bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Order Details Body */}
        <div className="p-5 space-y-3.5 text-xs text-slate-300">
          {/* Symbol & Routing Banner */}
          <div className="p-3 bg-obsidian rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-white">{order.symbol}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{order.instrumentType}</div>
            </div>
            <span
              className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase ${
                order.isPaper
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
              }`}
            >
              {order.isPaper ? 'PAPER SIM' : 'LIVE REAL MONEY'}
            </span>
          </div>

          {/* Grid Stats */}
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">Action &amp; Product</div>
              <div className="font-bold text-emerald-400">BUY (INTRADAY MIS)</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">Order Quantity</div>
              <div className="font-bold text-cyan-300">
                {order.lots ? `${order.lots} Lot (${order.quantity} Qty)` : `${order.quantity} Shares`}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">Order Price</div>
              <div className="font-bold text-white">₹{order.entryPrice.toFixed(2)} (MARKET)</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">Est. Capital Required</div>
              <div className="font-bold text-amber-300">
                ₹{order.capitalRequired.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-rose-400">Stop-Loss (1R)</div>
              <div className="font-bold text-rose-400">₹{order.stopLossPrice.toFixed(2)}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-emerald-400">Target (1:2 R:R)</div>
              <div className="font-bold text-emerald-400">₹{order.targetPrice.toFixed(2)}</div>
            </div>
          </div>

          {!order.isPaper && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-200">
              ⚠️ <strong>Pre-Trade Verification:</strong> Ensure you have sufficient cash balance in your Dhan account. Market orders execute immediately at the best available bid/offer.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`px-5 py-2 rounded-lg text-xs font-bold shadow-md transition flex items-center gap-1.5 ${
              order.isPaper
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }`}
          >
            {isSubmitting ? (
              <span>Dispatching...</span>
            ) : (
              <span>🚀 {order.isPaper ? 'Execute Paper Trade' : 'Dispatch Live Dhan Order'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
