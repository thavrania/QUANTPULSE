import React, { useState } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { buildNextActionPayload } from '@/lib/engine/optionPricing';
import { LiveOrderConfirmationModal, OrderPreviewDetails } from '@/components/modals/LiveOrderConfirmationModal';

export function ZoneD_NextAction() {
  const {
    watchlist,
    selectedTicker,
    config,
    executeBuy,
    forceCrossover,
    idempotencyLocks,
    setIsJsonModalOpen,
    setIsOptionChainModalOpen,
    showToast,
    feedMode,
  } = useQuantPulse();

  const [isPaperMode, setIsPaperMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('qp_order_routing_mode') !== 'LIVE';
    }
    return true;
  });
  const [previewOrder, setPreviewOrder] = useState<OrderPreviewDetails | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);

  const handleToggleRoutingMode = (paper: boolean) => {
    setIsPaperMode(paper);
    if (typeof window !== 'undefined') {
      localStorage.setItem('qp_order_routing_mode', paper ? 'PAPER' : 'LIVE');
      showToast(
        paper
          ? '📝 Order Routing set to Paper Virtual Engine (Zero Risk).'
          : '⚡ Order Routing set to Live Dhan Exchange API.',
        paper ? 'info' : 'amber'
      );
    }
  };

  const stock =
    watchlist.find((s) => s.ticker === selectedTicker) || watchlist[0];
  if (!stock) return null;

  const payload = buildNextActionPayload(stock, config, feedMode === 'SIMULATION');
  const isEligible = payload.isEligibleForBuy;
  const isAlreadyTraded = idempotencyLocks.includes(stock.ticker);
  const showCashFallback = config.instrumentMode === 'OPTION' && !stock.isFnO;
  const activeLeg =
    payload.toggleConfiguration.effectiveInstrumentMode === 'OPTION' &&
    payload.optionBuyDetails
      ? payload.optionBuyDetails
      : payload.stockBuyDetails;

  return (
    <section className="bg-panel rounded-xl border border-slate-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Zone D: Next Action Details
          </h2>
          <p className="text-[11px] text-slate-400">Driven by Toggle 1 (Stock/Option) &amp; Toggle 2</p>
        </div>
        <button
          type="button"
          onClick={() => setIsJsonModalOpen(true)}
          className="text-[11px] font-mono px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition"
        >
          &#123; &#125; JSON
        </button>
      </div>

      {/* Dynamic Action Container */}
      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3 overflow-y-auto">
        <div className="space-y-3">
          {/* Stock Header & Status */}
          <div
            className={`p-3 rounded-xl bg-obsidian border flex items-center justify-between ${
              isEligible ? 'border-emerald-500/40' : 'border-slate-800'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-white font-mono">{stock.ticker}</span>
                {stock.shortName && stock.shortName.trim().toUpperCase() !== stock.ticker.trim().toUpperCase() && (
                  <span className="text-xs font-semibold text-cyan-300">
                    ({stock.shortName})
                  </span>
                )}
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    isEligible
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : payload.eligibilityStatus === 'HIGH_VOL_BEARISH'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isEligible
                    ? 'ELIGIBLE FOR BUY'
                    : payload.eligibilityStatus === 'HIGH_VOL_BEARISH'
                    ? 'SHARES CROSSED (BEARISH)'
                    : 'NOT ELIGIBLE YET'}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium mt-0.5">{stock.name}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                Today Shares: <span className="text-white font-semibold">{(stock.todayTradedShares !== undefined ? stock.todayTradedShares : Math.round(stock.todayVolM * 1_000_000)).toLocaleString('en-IN')} shares</span>
                {' '}/ 20D Avg:{' '}
                <span className="text-cyan-300 font-semibold">{(stock.avg20DTradedShares || Math.round(stock.avgVol20DM * 1_000_000)).toLocaleString('en-IN')} shares</span>
                {' '}({payload.volumeTracking.crossoverProgressPct}%)
              </div>
            </div>
          </div>

          {/* Crossover Audit Banner */}
          {isEligible ? (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-300 flex items-center gap-1">
                  ⏱️ 20D Shares Crossover Time:
                </span>
                <span className="font-mono font-bold text-amber-300 bg-obsidian/80 px-2 py-0.5 rounded border border-amber-500/30">
                  {stock.crossoverTime} IST
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono">
                <span>
                  Price @ Crossover: <strong>₹{stock.crossoverSpotPrice?.toFixed(2)}</strong>
                </span>
                <span>
                  Current LTP: <strong className="text-emerald-300">₹{stock.spotLtp.toFixed(2)}</strong>
                </span>
              </div>
            </div>
          ) : payload.eligibilityStatus === 'HIGH_VOL_BEARISH' ? (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
              <div className="text-xs font-bold text-rose-300 flex items-center justify-between">
                <span>⚠️ Traded Shares Crossed 20D Average, but Price is Bearish</span>
                <span className="font-mono text-emerald-400">Shares: {payload.volumeTracking.crossoverProgressPct}%</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Rule 1 Filter: Buying is locked because <strong className="text-white">{stock.ticker}</strong> is trading below its day open / red candle (LTP: ₹{stock.spotLtp.toFixed(2)}). Buy orders require both 20D traded shares breakout AND bullish price action.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="text-xs font-bold text-amber-300 flex items-center justify-between">
                <span>⏳ Waiting for 20D Traded Shares Crossover</span>
                <span className="font-mono">{payload.volumeTracking.crossoverProgressPct}%</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Needs <strong className="font-mono text-white">+{Math.max(0, (stock.avg20DTradedShares || Math.round(stock.avgVol20DM * 1_000_000)) - (stock.todayTradedShares !== undefined ? stock.todayTradedShares : Math.round(stock.todayVolM * 1_000_000))).toLocaleString('en-IN')}</strong>{' '}
                more traded shares today to beat the 20-day average (<strong className="font-mono text-cyan-300">{(stock.avg20DTradedShares || Math.round(stock.avgVol20DM * 1_000_000)).toLocaleString('en-IN')} shares</strong>) and unlock buying.
              </p>
              <button
                type="button"
                onClick={() => forceCrossover(stock.ticker)}
                className="w-full py-1.5 rounded-lg text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition"
              >
                ⚡ Simulate Traded Shares Crossover Now
              </button>
            </div>
          )}

          {/* Cash Fallback Notice */}
          {showCashFallback && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
              ⚠️ <strong>Cash-Only Stock:</strong> {stock.ticker} has no F&amp;O Option Chain. Automatically showing{' '}
              <strong>Stock Equity</strong> details.
            </div>
          )}

          {/* Next Action Details (Stock vs Option) */}
          <div className="p-3.5 rounded-xl bg-obsidian/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Next Action (Toggle 1)</div>
                <div
                  className={`text-xs font-bold ${
                    activeLeg.instrumentType.includes('OPTION') ? 'text-purple-300' : 'text-cyan-300'
                  }`}
                >
                  {activeLeg.instrumentType}
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-white bg-slate-900 px-2.5 py-1 rounded border border-slate-700">
                {activeLeg.symbol}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400">Entry Price</div>
                <div className="font-bold text-white">₹{activeLeg.entryPrice.toFixed(2)}</div>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400">Order Quantity</div>
                <div className="font-bold text-cyan-300">
                  {'lots' in activeLeg && activeLeg.lots
                    ? `${activeLeg.lots} Lot (${activeLeg.quantity} Qty)`
                    : `${activeLeg.quantity} Shares`}
                </div>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] text-rose-300">Stop-Loss (1R)</div>
                <div className="font-bold text-rose-400">₹{activeLeg.stopLossPrice.toFixed(2)}</div>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] text-emerald-300">Target (1:2)</div>
                <div className="font-bold text-emerald-400">₹{activeLeg.targetPrice.toFixed(2)}</div>
              </div>
            </div>

            {'lots' in activeLeg && activeLeg.lots && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-4 gap-1.5 text-[11px] font-mono">
                  <div className="bg-purple-500/10 border border-purple-500/20 p-1.5 rounded text-center">
                    <div className="text-[9px] text-purple-300 uppercase">ATM Strike</div>
                    <div className="font-bold text-white">{activeLeg.strikePrice} CE</div>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 p-1.5 rounded text-center">
                    <div className="text-[9px] text-purple-300 uppercase">Delta (Δ)</div>
                    <div className="font-bold text-cyan-300">{activeLeg.delta}</div>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 p-1.5 rounded text-center">
                    <div className="text-[9px] text-purple-300 uppercase">Theta (Θ)</div>
                    <div className="font-bold text-rose-300">-₹{+(activeLeg.entryPrice * 0.045).toFixed(1)}/d</div>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 p-1.5 rounded text-center">
                    <div className="text-[9px] text-purple-300 uppercase">IV %</div>
                    <div className="font-bold text-white">{activeLeg.ivPct}%</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOptionChainModalOpen(true)}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition flex items-center justify-center gap-1.5"
                >
                  <span>📊 Inspect Multi-Strike Option Chain Matrix &amp; PCR</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Execution Footer (Manual vs Auto & Paper vs Live) */}
        <div className="pt-2 border-t border-slate-800 space-y-2.5">
          {/* OMS Routing Selector (Paper vs Live Dhan) */}
          <div className="flex items-center justify-between bg-obsidian px-2.5 py-1.5 rounded-lg border border-slate-800 text-[10px]">
            <span className="text-slate-400 font-semibold uppercase">Routing:</span>
            <div className="inline-flex items-center p-0.5 rounded-md bg-slate-900 border border-slate-700">
              <button
                type="button"
                onClick={() => handleToggleRoutingMode(true)}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  isPaperMode
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📝 Paper Sim
              </button>
              <button
                type="button"
                onClick={() => handleToggleRoutingMode(false)}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  !isPaperMode
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚡ Live Dhan
              </button>
            </div>
          </div>

          {config.executionMode === 'MANUAL' ? (
            isEligible ? (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewOrder({
                      ticker: stock.ticker,
                      symbol: activeLeg.symbol,
                      instrumentType: activeLeg.instrumentType,
                      action: 'BUY',
                      quantity: activeLeg.quantity,
                      lots: 'lots' in activeLeg ? activeLeg.lots : null,
                      entryPrice: activeLeg.entryPrice,
                      stopLossPrice: activeLeg.stopLossPrice,
                      targetPrice: activeLeg.targetPrice,
                      capitalRequired: activeLeg.capitalRequired,
                      isPaper: isPaperMode,
                    });
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 shadow-lg transition flex items-center justify-center gap-2 ${
                    isPaperMode
                      ? 'bg-emerald-500 hover:bg-emerald-400'
                      : 'bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400'
                  }`}
                >
                  <span>🚀 Execute {isPaperMode ? 'Paper Buy' : 'LIVE BUY'}: {activeLeg.symbol}</span>
                </button>
                <div className="text-[10px] text-center text-slate-400 mt-1">
                  Routing: <strong className={isPaperMode ? 'text-cyan-300' : 'text-rose-400'}>{isPaperMode ? 'Paper Virtual Engine' : 'Live Dhan Exchange API'}</strong>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-800/80 text-slate-500 border border-slate-700 cursor-not-allowed"
              >
                🔒 Locked Until 20D Traded Shares Crossover
              </button>
            )
          ) : (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                <span>🤖 AUTO EXECUTION MODE ACTIVE</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20">
                  {isAlreadyTraded ? 'ORDER DISPATCHED' : 'ARMED'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {isAlreadyTraded
                  ? `${stock.ticker} was automatically bought upon crossing its 20-Day Traded Shares Average at ${stock.crossoverTime}.`
                  : `The instant ${stock.ticker} crosses ${stock.avgVol20DM.toFixed(2)}M traded shares, the system will auto-buy ${activeLeg.symbol} via ${isPaperMode ? 'Paper Engine' : 'Live Dhan API'}.`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pre-Trade Confirmation Modal */}
      <LiveOrderConfirmationModal
        isOpen={Boolean(previewOrder)}
        order={previewOrder}
        isSubmitting={isSubmittingOrder}
        onCancel={() => setPreviewOrder(null)}
        onConfirm={async () => {
          if (!previewOrder) return;
          setIsSubmittingOrder(true);
          try {
            const clientId = localStorage.getItem('qp_dhan_client_id') || '';
            const accessToken = localStorage.getItem('qp_dhan_access_token') || '';

            const res = await fetch('/api/broker/dhan/place-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...previewOrder,
                clientId,
                accessToken,
              }),
            });

            const data = await res.json();
            if (data.success) {
              executeBuy(previewOrder.ticker, 'MANUAL');
              showToast(`✅ ${data.message}`, 'emerald');
            } else {
              showToast(`❌ ${data.message}`, 'rose');
            }
          } catch (err: any) {
            showToast(`Order failed: ${err.message}`, 'rose');
          } finally {
            setIsSubmittingOrder(false);
            setPreviewOrder(null);
          }
        }}
      />
    </section>
  );
}
