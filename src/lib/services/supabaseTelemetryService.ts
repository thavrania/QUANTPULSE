// =====================================================================
// QUANTPULSE — Supabase Telemetry & Audit Logging Service
// Writes immutable audit events for orders, TSL state transitions,
// and daily P&L performance to the Supabase Cloud PostgreSQL Vault.
// =====================================================================

import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  TradeLog,
  TslAuditTrailEntry,
  DailyPnlJournal,
  LiveTickSnapshot,
} from '@/lib/types/quant';

/**
 * Logs a newly dispatched trade order (Paper Sim or Live Dhan HQ) to Supabase.
 */
export async function logTradeOrderToCloud(trade: TradeLog): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase.from('trade_logs').insert([
      {
        order_id: trade.order_id,
        ticker: trade.ticker,
        symbol: trade.symbol,
        action: trade.action,
        instrument_type: trade.instrument_type,
        routing_mode: trade.routing_mode,
        quantity: trade.quantity,
        lots: trade.lots || null,
        entry_price: trade.entry_price,
        exit_price: null,
        stop_loss: trade.stop_loss,
        target_price: trade.target_price,
        realized_pnl: 0,
        crossover_ref_time: trade.crossover_ref_time,
        status: 'OPEN',
        buy_value: trade.buy_value || null,
        pi_pct: trade.pi_pct || 3.1416,
        target_1: trade.target_1 || null,
        target_2: trade.target_2 || null,
        target_3: trade.target_3 || null,
        target_4: trade.target_4 || null,
        highest_target_achieved: trade.highest_target_achieved || 'NONE',
        target_achievement_time: trade.target_achievement_time || null,
      },
    ]);

    if (error) {
      console.warn('Supabase trade_logs insert error (table may need schema update):', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Error in logTradeOrderToCloud:', err.message);
    return false;
  }
}

/**
 * Updates an order status to CLOSED with final realized PnL and exit price.
 */
export async function closeTradeOrderInCloud(
  orderId: string,
  exitPrice: number,
  realizedPnl: number,
  highestTarget?: 'NONE' | 'T1' | 'T2' | 'T3' | 'T4',
  targetAchievementTime?: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const updateObj: Record<string, any> = {
      status: 'CLOSED',
      exit_price: exitPrice,
      realized_pnl: realizedPnl,
      closed_at: new Date().toISOString(),
    };
    if (highestTarget) updateObj.highest_target_achieved = highestTarget;
    if (targetAchievementTime) updateObj.target_achievement_time = targetAchievementTime;

    const { error } = await supabase
      .from('trade_logs')
      .update(updateObj)
      .eq('order_id', orderId);

    if (error) {
      console.warn('Supabase trade_logs update error:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Error in closeTradeOrderInCloud:', err.message);
    return false;
  }
}

/**
 * Updates an order's highest achieved Pi% target level.
 */
export async function updateTradeTargetMilestoneInCloud(
  orderId: string,
  highestTarget: 'NONE' | 'T1' | 'T2' | 'T3' | 'T4',
  targetAchievementTime: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('trade_logs')
      .update({
        highest_target_achieved: highestTarget,
        target_achievement_time: targetAchievementTime,
      })
      .eq('order_id', orderId);

    if (error) {
      console.warn('Supabase trade_logs milestone update error:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Error in updateTradeTargetMilestoneInCloud:', err.message);
    return false;
  }
}

/**
 * Logs a Trailing Stop-Loss state transition (State 1 -> 2 -> 3 -> 4).
 */
export async function logTslTransitionToCloud(entry: TslAuditTrailEntry): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase.from('tsl_audit_trail').insert([
      {
        position_id: entry.position_id,
        symbol: entry.symbol,
        from_state: entry.from_state,
        to_state: entry.to_state,
        from_label: entry.from_label,
        to_label: entry.to_label,
        spot_price_at_transition: entry.spot_price_at_transition,
        option_ltp_at_transition: entry.option_ltp_at_transition || null,
        new_trailing_sl: entry.new_trailing_sl,
        pnl_locked: entry.pnl_locked,
        timestamp_ist: entry.timestamp_ist,
      },
    ]);

    if (error) {
      console.warn('Supabase tsl_audit_trail insert error:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Error in logTslTransitionToCloud:', err.message);
    return false;
  }
}

/**
 * Saves daily post-market performance journal metrics.
 */
export async function logDailyPnlJournalToCloud(journal: DailyPnlJournal): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase.from('daily_pnl_journal').upsert([
      {
        trading_date: journal.trading_date,
        total_trades: journal.total_trades,
        winning_trades: journal.winning_trades,
        losing_trades: journal.losing_trades,
        win_rate_pct: journal.win_rate_pct,
        gross_realized_pnl: journal.gross_realized_pnl,
        max_drawdown: journal.max_drawdown,
        symbols_traded: journal.symbols_traded,
        notes: journal.notes || '',
      },
    ]);

    if (error) {
      console.warn('Supabase daily_pnl_journal upsert error:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Error in logDailyPnlJournalToCloud:', err.message);
    return false;
  }
}

/**
 * Batch updates live prices, volumes, and OHLC metrics to public.watchlist.
 */
export async function syncLiveWatchlistToCloud(
  quotes: Record<
    string,
    {
      ltp: number;
      volumeM: number;
      high?: number;
      low?: number;
      open?: number;
      close?: number;
      changePct?: number;
    }
  >
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const promises = Object.entries(quotes).map(([ticker, q]) => {
      return supabase!
        .from('watchlist')
        .update({
          spot_ltp: q.ltp,
          today_vol_m: q.volumeM,
          updated_at: new Date().toISOString(),
        })
        .eq('ticker', ticker);
    });

    await Promise.all(promises);
    return true;
  } catch (err: any) {
    console.warn('Error syncing live watchlist to Supabase:', err.message);
    return false;
  }
}

/**
 * Logs batch tick snapshots to Supabase live_tick_snapshots table for high-resolution audit
 */
export async function logBatchTickSnapshotsToCloud(
  snapshots: {
    ticker: string;
    timestamp_ist: string;
    spot_ltp: number;
    today_vol_m: number;
    avg_vol_20d_m: number;
    rvol_ratio: number;
  }[]
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || snapshots.length === 0) return false;

  try {
    const { error } = await supabase.from('live_tick_snapshots').insert(snapshots);
    if (error) {
      console.warn('Supabase live_tick_snapshots insert notice:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('Error in logBatchTickSnapshotsToCloud:', err.message);
    return false;
  }
}

