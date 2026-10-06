'use client';

import React, { useState, useEffect } from 'react';
import {
  StrategyConfiguration,
  BacktestResult,
  TradeRecord,
  NoTradeRecord,
} from '@/lib/strategies/niftyBreakout180/types';
import { DEFAULT_STRATEGY_CONFIG, STRATEGY_ID, STRATEGY_NAME, STRATEGY_VERSION } from '@/lib/strategies/niftyBreakout180/constants';
import { runBacktest } from '@/lib/strategies/niftyBreakout180/backtestRunner';
import { getSampleOptionData } from '@/lib/strategies/niftyBreakout180/sampleData';
import { TradeReplayModal } from './TradeReplayModal';

export function Zone_NiftyBreakout180() {
  const [config, setConfig] = useState<StrategyConfiguration>(DEFAULT_STRATEGY_CONFIG);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [selectedTradeForReplay, setSelectedTradeForReplay] = useState<TradeRecord | null>(null);
  const [isReplayModalOpen, setIsReplayModalOpen] = useState<boolean>(false);
  const [activeTableTab, setActiveTableTab] = useState<'TRADES' | 'NO_TRADES' | 'JSON_CONFIG'>('TRADES');

  // Run initial backtest on mount using default configuration
  useEffect(() => {
    executeBacktest(DEFAULT_STRATEGY_CONFIG);
  }, []);

  const executeBacktest = async (cfgToRun: StrategyConfiguration) => {
    setIsRunning(true);
    try {
      // Execute using client-side engine with standard high-fidelity sample option-chain dataset
      const res = runBacktest({
        candlesByDate: getSampleOptionData(),
        config: cfgToRun,
        dataSourceName: 'NSE_HISTORICAL_VAULT_1MIN',
      });
      setBacktestResult(res);
    } catch (err) {
      console.error('Error running backtest:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleConfigChange = <K extends keyof StrategyConfiguration>(
    key: K,
    val: StrategyConfiguration[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: val }));
  };

  const handleResetDefaults = () => {
    setConfig(DEFAULT_STRATEGY_CONFIG);
    executeBacktest(DEFAULT_STRATEGY_CONFIG);
  };

  const metrics = backtestResult?.metrics;

  return (
    <div className="space-y-4 font-sans text-slate-100">
      
      {/* 1. STRATEGY COMMAND HEADER & INVARIANT BANNER */}
      <div className="bg-panel rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xl shadow-inner">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {STRATEGY_NAME}
                </h2>
                <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/40">
                  {STRATEGY_ID}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                  v{STRATEGY_VERSION} • BACKTEST ENGINE
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
                <span>09:25 CE/PE Selection (₹180)</span>
                <span>•</span>
                <span>09:30+ First Cross Trigger</span>
                <span>•</span>
                <span>SL: ₹160</span>
                <span>•</span>
                <span>Target: ₹220</span>
                <span>•</span>
                <span>Force Exit: 09:45</span>
                <span>•</span>
                <span className="text-amber-400 font-bold">Max 1 Trade/Day</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 transition"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={() => executeBacktest(config)}
              disabled={isRunning}
              className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <span className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <span>▶</span>
                  <span>Run Backtest</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Strategy Invariant Guardrails Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-400">🛡️ STRICT INVARIANTS:</span>
            <span>Zero Look-Ahead Bias • No Indicators • CE/PE Selected Independently • One Trade/Day Hard Lock • Opposite Leg Invalidation.</span>
          </div>
          <div className="text-[11px] font-mono text-amber-300/80">
            Timezone: Asia/Kolkata (IST = UTC+05:30)
          </div>
        </div>
      </div>

      {/* 2. CONFIGURATION PARAMETERS CONTROL PANEL (Part 30) */}
      <div className="bg-panel rounded-2xl border border-slate-800 p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            Strategy Parameters & Execution Configuration
          </h3>
          <span className="text-[11px] font-mono text-slate-500">All parameters fully auditable</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono">
          
          {/* Target Premium */}
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 text-[11px]">Target Premium</label>
            <div className="flex items-center gap-1">
              <span className="text-amber-400 font-bold">₹</span>
              <input
                type="number"
                value={config.targetPremium}
                onChange={(e) => handleConfigChange('targetPremium', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-bold"
              />
            </div>
          </div>

          {/* Stop Loss Premium */}
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 text-[11px]">Stop Loss (SL)</label>
            <div className="flex items-center gap-1">
              <span className="text-rose-400 font-bold">₹</span>
              <input
                type="number"
                value={config.stopLoss}
                onChange={(e) => handleConfigChange('stopLoss', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-bold"
              />
            </div>
          </div>

          {/* Target Profit Premium */}
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 text-[11px]">Target Profit</label>
            <div className="flex items-center gap-1">
              <span className="text-emerald-400 font-bold">₹</span>
              <input
                type="number"
                value={config.target}
                onChange={(e) => handleConfigChange('target', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-bold"
              />
            </div>
          </div>

          {/* Contract Selection Time */}
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 text-[11px]">Selection Time</label>
            <input
              type="text"
              value={config.contractSelectionTime}
              disabled
              className="w-full bg-slate-950/70 border border-slate-800 rounded px-2 py-1 text-cyan-400 font-bold cursor-not-allowed"
            />
          </div>

          {/* Breakout Start Time */}
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 text-[11px]">Breakout Start</label>
            <input
              type="text"
              value={config.breakoutStartTime}
              disabled
              className="w-full bg-slate-950/70 border border-slate-800 rounded px-2 py-1 text-cyan-400 font-bold cursor-not-allowed"
            />
          </div>

          {/* Force Exit Time */}
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 text-[11px]">Force Exit</label>
            <input
              type="text"
              value={config.forceExitTime}
              disabled
              className="w-full bg-slate-950/70 border border-slate-800 rounded px-2 py-1 text-rose-400 font-bold cursor-not-allowed"
            />
          </div>

          {/* Entry Execution Mode */}
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 text-[11px]">Entry Execution</label>
            <select
              value={config.entryExecutionMode}
              onChange={(e) => handleConfigChange('entryExecutionMode', e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-[11px]"
            >
              <option value="NEXT_CANDLE_OPEN">NEXT_CANDLE_OPEN (Default)</option>
              <option value="CROSS_LEVEL">CROSS_LEVEL (₹180)</option>
              <option value="CURRENT_CANDLE_CLOSE">CURRENT_CANDLE_CLOSE</option>
            </select>
          </div>

          {/* Same-Timestamp Resolution */}
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 text-[11px]">Same Minute Cross</label>
            <select
              value={config.sameTimestampResolution}
              onChange={(e) => handleConfigChange('sameTimestampResolution', e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-[11px]"
            >
              <option value="NO_TRADE">NO_TRADE (Default)</option>
              <option value="CE_FIRST">CE_FIRST</option>
              <option value="PE_FIRST">PE_FIRST</option>
              <option value="HIGHER_MOMENTUM">HIGHER_MOMENTUM</option>
            </select>
          </div>

          {/* Intrabar Conflict Mode */}
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 text-[11px]">SL/Target Conflict</label>
            <select
              value={config.intrabarConflictMode}
              onChange={(e) => handleConfigChange('intrabarConflictMode', e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-[11px]"
            >
              <option value="STOP_FIRST">STOP_FIRST (Conservative)</option>
              <option value="TARGET_FIRST">TARGET_FIRST</option>
              <option value="AMBIGUOUS_EXIT">AMBIGUOUS_EXIT</option>
            </select>
          </div>

          {/* Slippage Mode */}
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 text-[11px]">Slippage Model</label>
            <div className="grid grid-cols-2 gap-1">
              <select
                value={config.slippageMode}
                onChange={(e) => handleConfigChange('slippageMode', e.target.value as any)}
                className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-white text-[10px]"
              >
                <option value="NONE">NONE</option>
                <option value="POINTS">POINTS</option>
                <option value="PERCENTAGE">%</option>
              </select>
              <input
                type="number"
                step="0.1"
                placeholder="Val"
                value={config.slippageValue}
                onChange={(e) => handleConfigChange('slippageValue', Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-white text-[11px]"
              />
            </div>
          </div>

          {/* Brokerage & Indian Charges */}
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 text-[11px]">Brokerage/Order</label>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">₹</span>
              <input
                type="number"
                value={config.brokeragePerOrder}
                onChange={(e) => handleConfigChange('brokeragePerOrder', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-bold"
              />
            </div>
          </div>

          {/* Quantity in Lots */}
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 text-[11px]">Quantity (Lots)</label>
            <input
              type="number"
              min="1"
              value={config.quantityLots}
              onChange={(e) => handleConfigChange('quantityLots', Math.max(1, Number(e.target.value)))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-bold"
            />
          </div>

        </div>
      </div>

      {/* 3. EXECUTIVE BACKTEST SUMMARY DASHBOARD (Part 31) */}
      {metrics && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
            
            {/* Net Profit */}
            <div className="bg-panel rounded-xl border border-slate-800 p-3 shadow-lg">
              <span className="text-[11px] text-slate-400 block font-mono">Net Profit</span>
              <span className={`text-lg font-bold font-mono ${metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {metrics.netProfit >= 0 ? `+₹${metrics.netProfit.toLocaleString('en-IN')}` : `-₹${Math.abs(metrics.netProfit).toLocaleString('en-IN')}`}
              </span>
              <span className="text-[10px] text-slate-500 block font-mono">Gross: ₹{metrics.grossProfit}</span>
            </div>

            {/* Win Rate */}
            <div className="bg-panel rounded-xl border border-slate-800 p-3 shadow-lg">
              <span className="text-[11px] text-slate-400 block font-mono">Win Rate</span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                {metrics.winRatePct}%
              </span>
              <span className="text-[10px] text-slate-500 block font-mono">
                {metrics.winningTrades}W / {metrics.losingTrades}L
              </span>
            </div>

            {/* Profit Factor */}
            <div className="bg-panel rounded-xl border border-slate-800 p-3 shadow-lg">
              <span className="text-[11px] text-slate-400 block font-mono">Profit Factor</span>
              <span className="text-lg font-bold font-mono text-cyan-400">
                {metrics.profitFactor}
              </span>
              <span className="text-[10px] text-slate-500 block font-mono">Loss: ₹{metrics.grossLoss}</span>
            </div>

            {/* Total Trades */}
            <div className="bg-panel rounded-xl border border-slate-800 p-3 shadow-lg">
              <span className="text-[11px] text-slate-400 block font-mono">Total Trades</span>
              <span className="text-lg font-bold font-mono text-white">
                {metrics.totalTrades}
              </span>
              <span className="text-[10px] text-slate-500 block font-mono">
                {metrics.totalTradingDays} Days ({metrics.noTradeDays} No-Trd)
              </span>
            </div>

            {/* Max Drawdown */}
            <div className="bg-panel rounded-xl border border-slate-800 p-3 shadow-lg">
              <span className="text-[11px] text-slate-400 block font-mono">Max Drawdown</span>
              <span className="text-lg font-bold font-mono text-rose-400">
                ₹{metrics.maxDrawdown}
              </span>
              <span className="text-[10px] text-slate-500 block font-mono">DD: {metrics.maxDrawdownPct}%</span>
            </div>

            {/* CE vs PE Breakdown */}
            <div className="bg-panel rounded-xl border border-slate-800 p-3 shadow-lg">
              <span className="text-[11px] text-slate-400 block font-mono">CE / PE Split</span>
              <div className="flex items-center gap-2 text-xs font-mono font-bold mt-1">
                <span className="text-emerald-400">{metrics.ceTradeCount} CE ({metrics.ceWinRate}%)</span>
                <span className="text-slate-600">/</span>
                <span className="text-rose-400">{metrics.peTradeCount} PE ({metrics.peWinRate}%)</span>
              </div>
            </div>

            {/* Exit Distribution */}
            <div className="bg-panel rounded-xl border border-slate-800 p-3 shadow-lg">
              <span className="text-[11px] text-slate-400 block font-mono">Exit Reasons</span>
              <div className="text-[10px] font-mono mt-0.5 space-y-0.5">
                <div className="text-emerald-400">Target: {metrics.targetHitPct}%</div>
                <div className="text-rose-400">SL: {metrics.slHitPct}%</div>
                <div className="text-cyan-400">Time: {metrics.timeExitPct}%</div>
              </div>
            </div>

            {/* Avg Trade PnL */}
            <div className="bg-panel rounded-xl border border-slate-800 p-3 shadow-lg">
              <span className="text-[11px] text-slate-400 block font-mono">Avg Trade P&L</span>
              <span className={`text-base font-bold font-mono ${metrics.averageTradePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {metrics.averageTradePnl >= 0 ? `+₹${metrics.averageTradePnl}` : `-₹${Math.abs(metrics.averageTradePnl)}`}
              </span>
              <span className="text-[10px] text-slate-500 block font-mono">Avg Hold: {metrics.averageHoldingTimeMinutes}m</span>
            </div>

          </div>

          {/* 4. DAILY EQUITY CURVE & PERFORMANCE CHARTS (Part 33) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            
            {/* Cumulative Equity Curve Chart (8 cols) */}
            <div className="lg:col-span-8 bg-panel rounded-2xl border border-slate-800 p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                    Cumulative Equity Curve (Net P&L in ₹)
                  </h3>
                </div>
                <span className="text-xs font-mono text-cyan-400 font-bold">
                  Peak: ₹{Math.max(...(backtestResult?.equityCurve.map((e) => e.cumulativePnl) || [0]))}
                </span>
              </div>

              {/* Interactive SVG Chart */}
              <div className="h-56 w-full relative">
                {backtestResult && backtestResult.equityCurve.length > 0 && (
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 800 200" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Zero Line */}
                    <line x1="0" y1="120" x2="800" y2="120" stroke="#334155" strokeDasharray="4 4" strokeWidth="1" />

                    {/* Chart Polyline Points */}
                    {(() => {
                      const points = backtestResult.equityCurve;
                      const maxPnl = Math.max(...points.map((p) => p.cumulativePnl), 1000);
                      const minPnl = Math.min(...points.map((p) => p.cumulativePnl), -1000);
                      const range = maxPnl - minPnl || 1;

                      const coords = points.map((p, idx) => {
                        const x = (idx / (points.length - 1 || 1)) * 760 + 20;
                        const y = 180 - ((p.cumulativePnl - minPnl) / range) * 160;
                        return { x, y, p };
                      });

                      const pathD = coords.reduce((acc, curr, idx) => {
                        return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
                      }, '');

                      const areaD = `${pathD} L ${coords[coords.length - 1].x} 190 L ${coords[0].x} 190 Z`;

                      return (
                        <>
                          <path d={areaD} fill="url(#equityGrad)" />
                          <path d={pathD} fill="none" stroke="#10B981" strokeWidth="2.5" />
                          {coords.map((c, i) => (
                            <g key={i}>
                              <circle
                                cx={c.x}
                                cy={c.y}
                                r="4"
                                className="fill-emerald-400 stroke-slate-900 stroke-2 hover:r-6 cursor-pointer"
                              />
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-2 pt-2 border-t border-slate-800/80">
                <span>Start: {backtestResult?.metadata.startDate}</span>
                <span>End: {backtestResult?.metadata.endDate}</span>
              </div>
            </div>

            {/* Daily P&L Distribution Bar Visualizer (4 cols) */}
            <div className="lg:col-span-4 bg-panel rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                    Daily P&L Distribution
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">By Session</span>
                </div>

                <div className="space-y-2">
                  {backtestResult?.equityCurve.map((pt, idx) => {
                    const isProfit = pt.dailyPnl > 0;
                    const isLoss = pt.dailyPnl < 0;
                    const isNoTrade = pt.dailyPnl === 0;

                    return (
                      <div key={idx} className="flex items-center justify-between text-xs font-mono p-1.5 rounded bg-slate-900/40">
                        <span className="text-slate-400 text-[11px]">{pt.date}</span>
                        <div className="flex items-center gap-2">
                          {isProfit && (
                            <span className="text-emerald-400 font-bold">+₹{pt.dailyPnl}</span>
                          )}
                          {isLoss && (
                            <span className="text-rose-400 font-bold">-₹{Math.abs(pt.dailyPnl)}</span>
                          )}
                          {isNoTrade && (
                            <span className="text-slate-500 text-[10px] uppercase font-semibold">
                              {pt.noTradeReason || 'NO_TRADE'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Consecutive Wins: <strong className="text-emerald-400">{metrics?.maxConsecutiveWins}</strong></span>
                <span>Consecutive Losses: <strong className="text-rose-400">{metrics?.maxConsecutiveLosses}</strong></span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 5. INTERACTIVE TRADE LOG TABLE & NO-TRADE DAYS (Part 32 & 21) */}
      <div className="bg-panel rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        
        {/* Table Navigation Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTableTab('TRADES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition font-bold ${
                activeTableTab === 'TRADES'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Executed Trades ({backtestResult?.trades.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTableTab('NO_TRADES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition font-bold ${
                activeTableTab === 'NO_TRADES'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              No-Trade Days ({backtestResult?.noTradeDays.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTableTab('JSON_CONFIG')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition font-bold ${
                activeTableTab === 'JSON_CONFIG'
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Strategy JSON
            </button>
          </div>

          <span className="text-xs font-mono text-slate-400">
            Click &quot;Replay &amp; Audit&quot; on any trade to inspect 1-minute premium timeline
          </span>
        </div>

        {/* TAB 1: EXECUTED TRADES TABLE */}
        {activeTableTab === 'TRADES' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Expiry</th>
                  <th className="py-2.5 px-3">CE @ 09:25</th>
                  <th className="py-2.5 px-3">PE @ 09:25</th>
                  <th className="py-2.5 px-3">Trigger</th>
                  <th className="py-2.5 px-3">Entry</th>
                  <th className="py-2.5 px-3">SL</th>
                  <th className="py-2.5 px-3">Target</th>
                  <th className="py-2.5 px-3">Exit</th>
                  <th className="py-2.5 px-3">Exit Reason</th>
                  <th className="py-2.5 px-3">Gross</th>
                  <th className="py-2.5 px-3">Costs</th>
                  <th className="py-2.5 px-3">Net P&L</th>
                  <th className="py-2.5 px-3">Return</th>
                  <th className="py-2.5 px-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {backtestResult?.trades.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40 transition">
                    <td className="py-2.5 px-3 text-white font-semibold">{t.trading_date}</td>
                    <td className="py-2.5 px-3 text-slate-400">{t.expiry}</td>
                    <td className="py-2.5 px-3 text-emerald-400">
                      ₹{t.selected_ce_925_premium} <span className="text-[10px] text-slate-500">({t.selected_ce_strike})</span>
                    </td>
                    <td className="py-2.5 px-3 text-rose-400">
                      ₹{t.selected_pe_925_premium} <span className="text-[10px] text-slate-500">({t.selected_pe_strike})</span>
                    </td>
                    <td className="py-2.5 px-3 font-bold">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        t.trigger_option === 'CE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {t.trigger_option} @ {t.trigger_timestamp.slice(0, 5)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-white font-bold">₹{t.entry_price}</td>
                    <td className="py-2.5 px-3 text-rose-400">₹{t.stop_loss_price}</td>
                    <td className="py-2.5 px-3 text-emerald-400">₹{t.target_price}</td>
                    <td className="py-2.5 px-3 text-white font-bold">₹{t.exit_price}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        t.exit_reason === 'TARGET_HIT'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : t.exit_reason === 'SL_HIT'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}>
                        {t.exit_reason}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">₹{t.gross_pnl}</td>
                    <td className="py-2.5 px-3 text-slate-400">₹{t.brokerage + t.exchange_charges + t.taxes}</td>
                    <td className={`py-2.5 px-3 font-bold ${t.net_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.net_pnl >= 0 ? `+₹${t.net_pnl}` : `-₹${Math.abs(t.net_pnl)}`}
                    </td>
                    <td className={`py-2.5 px-3 ${t.return_percentage >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.return_percentage >= 0 ? `+${t.return_percentage}%` : `${t.return_percentage}%`}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTradeForReplay(t);
                          setIsReplayModalOpen(true);
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] transition font-semibold"
                      >
                        Replay &amp; Audit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: NO-TRADE DAYS (Part 21) */}
        {activeTableTab === 'NO_TRADES' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Trading Date</th>
                  <th className="py-2.5 px-3">No-Trade Reason</th>
                  <th className="py-2.5 px-3">Audit Details &amp; Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {backtestResult?.noTradeDays.map((nt, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40 transition">
                    <td className="py-2.5 px-3 text-white font-semibold">{nt.trading_date}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                        {nt.reason}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{nt.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: STRATEGY JSON CONFIGURATION (Part 38) */}
        {activeTableTab === 'JSON_CONFIG' && (
          <div className="p-4 bg-slate-950 font-mono text-xs overflow-x-auto">
            <div className="flex items-center justify-between mb-2 text-slate-400">
              <span>Reproducible JSON Configuration &amp; Metadata</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(JSON.stringify(config, null, 2))}
                className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-[11px]"
              >
                Copy JSON
              </button>
            </div>
            <pre className="text-emerald-400 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
              {JSON.stringify(
                {
                  configuration: config,
                  metadata: backtestResult?.metadata,
                },
                null,
                2
              )}
            </pre>
          </div>
        )}

      </div>

      {/* 6. TRADE REPLAY & STRATEGY AUDIT MODAL (Part 34 & 35) */}
      <TradeReplayModal
        trade={selectedTradeForReplay}
        isOpen={isReplayModalOpen}
        onClose={() => {
          setIsReplayModalOpen(false);
          setSelectedTradeForReplay(null);
        }}
      />

    </div>
  );
}
