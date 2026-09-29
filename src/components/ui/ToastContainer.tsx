'use client';

import React from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';

export function ToastContainer() {
  const { toasts, removeToast } = useQuantPulse();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let colors = 'bg-slate-900 border-cyan-500/50 text-slate-100';
        if (toast.variant === 'emerald') colors = 'bg-slate-900 border-emerald-500/60 text-emerald-200';
        if (toast.variant === 'amber') colors = 'bg-slate-900 border-amber-500/60 text-amber-200';
        if (toast.variant === 'rose') colors = 'bg-slate-900 border-rose-500/60 text-rose-200';

        return (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`pointer-events-auto px-3.5 py-2.5 rounded-xl border shadow-2xl text-xs font-medium transition-all duration-300 cursor-pointer ${colors}`}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
