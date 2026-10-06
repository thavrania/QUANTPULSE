// =====================================================================
// QUANTPULSE — REST API Route: NIFTY 09:30 Breakout Strategy
// Endpoint: /api/strategy/nifty-breakout-180
// Backtest Execution & Trade Replay Gateway
// =====================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { StrategyConfiguration } from '@/lib/strategies/niftyBreakout180/types';
import { DEFAULT_STRATEGY_CONFIG, STRATEGY_ID } from '@/lib/strategies/niftyBreakout180/constants';
import { runBacktest } from '@/lib/strategies/niftyBreakout180/backtestRunner';
import { getSampleOptionData } from '@/lib/strategies/niftyBreakout180/sampleData';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'RUN_BACKTEST';

    if (action === 'RUN_BACKTEST') {
      const userConfig: StrategyConfiguration = {
        ...DEFAULT_STRATEGY_CONFIG,
        ...(body.config || {}),
      };

      const candlesByDate = body.candlesByDate || getSampleOptionData();
      const startDate = body.startDate;
      const endDate = body.endDate;

      const backtestResult = runBacktest({
        candlesByDate,
        config: userConfig,
        startDate,
        endDate,
        dataSourceName: body.dataSourceName || 'QUANTPULSE_HISTORICAL_VAULT',
      });

      // Persist to Supabase if connected
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('backtest_runs').upsert({
            id: backtestResult.runId,
            strategy_id: STRATEGY_ID,
            strategy_version: backtestResult.version,
            configuration: backtestResult.config,
            start_date: backtestResult.metadata.startDate,
            end_date: backtestResult.metadata.endDate,
            total_days: backtestResult.metrics.totalTradingDays,
            traded_days: backtestResult.metrics.tradingDays,
            no_trade_days: backtestResult.metrics.noTradeDays,
            total_trades: backtestResult.metrics.totalTrades,
            winning_trades: backtestResult.metrics.winningTrades,
            losing_trades: backtestResult.metrics.losingTrades,
            win_rate_pct: backtestResult.metrics.winRatePct,
            loss_rate_pct: backtestResult.metrics.lossRatePct,
            gross_profit: backtestResult.metrics.grossProfit,
            gross_loss: backtestResult.metrics.grossLoss,
            net_profit: backtestResult.metrics.netProfit,
            profit_factor: backtestResult.metrics.profitFactor,
            max_drawdown: backtestResult.metrics.maxDrawdown,
            max_drawdown_pct: backtestResult.metrics.maxDrawdownPct,
            metadata: backtestResult.metadata,
          });

          if (backtestResult.trades.length > 0) {
            const tradeRows = backtestResult.trades.map((t) => ({
              trade_id: `${backtestResult.runId}_${t.trade_id}`,
              run_id: backtestResult.runId,
              trading_date: t.trading_date,
              underlying: t.underlying,
              expiry: t.expiry,
              selected_ce_symbol: t.selected_ce_symbol,
              selected_ce_strike: t.selected_ce_strike,
              selected_ce_925_premium: t.selected_ce_925_premium,
              selected_pe_symbol: t.selected_pe_symbol,
              selected_pe_strike: t.selected_pe_strike,
              selected_pe_925_premium: t.selected_pe_925_premium,
              trigger_option: t.trigger_option,
              trigger_option_type: t.trigger_option_type,
              trigger_timestamp: t.trigger_timestamp,
              entry_price: t.entry_price,
              entry_timestamp: t.entry_timestamp,
              stop_loss_price: t.stop_loss_price,
              target_price: t.target_price,
              exit_price: t.exit_price,
              exit_timestamp: t.exit_timestamp,
              exit_reason: t.exit_reason,
              gross_points: t.gross_points,
              gross_pnl: t.gross_pnl,
              brokerage: t.brokerage,
              exchange_charges: t.exchange_charges,
              taxes: t.taxes,
              slippage: t.slippage,
              net_pnl: t.net_pnl,
              return_percentage: t.return_percentage,
              holding_duration: t.holding_duration,
              lot_size: t.lot_size,
              quantity: t.quantity,
              audit_trail: t.audit_trail,
              timeline: t.timeline,
            }));

            await supabase.from('backtest_trades').upsert(tradeRows);
          }
        } catch (dbErr) {
          console.warn('[BACKTEST API] Supabase persistence warning (non-fatal):', dbErr);
        }
      }

      return NextResponse.json({
        success: true,
        result: backtestResult,
      });
    }

    if (action === 'GET_RUNS') {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('backtest_runs')
          .select('*')
          .eq('strategy_id', STRATEGY_ID)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && data) {
          return NextResponse.json({ success: true, runs: data });
        }
      }
      return NextResponse.json({ success: true, runs: [] });
    }

    return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('[BACKTEST API ERROR]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  // Quick ping or fetch default sample backtest
  const defaultResult = runBacktest({
    candlesByDate: getSampleOptionData(),
    config: DEFAULT_STRATEGY_CONFIG,
    dataSourceName: 'MOCK_HISTORICAL_FIXTURE',
  });

  return NextResponse.json({
    success: true,
    strategyId: STRATEGY_ID,
    defaultResult,
  });
}
