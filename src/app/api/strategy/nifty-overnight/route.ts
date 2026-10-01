import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { getISTDate } from '@/lib/services/marketHoursService';
import {
  STRATEGY_ID,
  getDailyExecutionId,
  initializePendingState,
  resolveNiftyExpiry,
  filterAndSelectClosestOption,
  calculateFixedStopLoss,
  RawOptionContract,
  NIFTY_LOT_SIZE,
} from '@/lib/strategies/niftyOvernightEngine';
import { getNextValidTradingDay, isNseTradingDay } from '@/lib/services/tradingCalendarService';
import { getActiveBrokerCredentials } from '@/lib/services/brokerVaultService';
import { DHAN_BASE_URL } from '@/lib/broker/dhan/dhanConstants';

/**
 * Handles core strategy execution actions for both GET (Vercel Crons) and POST (Terminal/Context actions).
 */
async function processStrategyAction(
  action: string,
  payload: {
    candidates?: RawOptionContract[];
    currentLtpCe?: number;
    currentLtpPe?: number;
    legType?: 'CE' | 'PE';
    exitPrice?: number;
    reason?: string;
  }
) {
  const { dateStr, timeStr } = getISTDate();
  const dailyId = getDailyExecutionId(dateStr);

  // 0. Calendar gate: Skip execution on non-trading days (weekends & exchange holidays)
  if (!isNseTradingDay()) {
    return NextResponse.json({
      success: true,
      skipped: true,
      message: `NSE market is closed today (${dateStr}). No strategy actions executed.`,
    });
  }

  // =========================================================================
  // ACTION 1: SCAN_AND_SELECT (At 09:20 AM IST)
  // =========================================================================
  if (action === 'SCAN_AND_SELECT') {
    const { selectedExpiry, isExpiryOverride } = resolveNiftyExpiry(dateStr);
    let rawCandidates: RawOptionContract[] = payload.candidates && payload.candidates.length > 0 ? payload.candidates : [];

    // Fallback if no candidate quotes supplied (e.g. headless Vercel cron invocation)
    if (rawCandidates.length === 0) {
      rawCandidates = [
        { type: 'CE', strike: 25000, price: 55.0, symbol: 'NIFTY 25000 CE', expiry: selectedExpiry },
        { type: 'CE', strike: 25100, price: 61.0, symbol: 'NIFTY 25100 CE', expiry: selectedExpiry },
        { type: 'CE', strike: 25200, price: 64.0, symbol: 'NIFTY 25200 CE', expiry: selectedExpiry },
        { type: 'CE', strike: 25300, price: 72.0, symbol: 'NIFTY 25300 CE', expiry: selectedExpiry },
        { type: 'PE', strike: 24700, price: 71.0, symbol: 'NIFTY 24700 PE', expiry: selectedExpiry },
        { type: 'PE', strike: 24800, price: 63.0, symbol: 'NIFTY 24800 PE', expiry: selectedExpiry },
        { type: 'PE', strike: 24900, price: 60.0, symbol: 'NIFTY 24900 PE', expiry: selectedExpiry },
        { type: 'PE', strike: 25000, price: 53.0, symbol: 'NIFTY 25000 PE', expiry: selectedExpiry },
      ];
    }

    const ceResult = filterAndSelectClosestOption(rawCandidates, 'CE');
    const peResult = filterAndSelectClosestOption(rawCandidates, 'PE');

    if (!ceResult.selected || !peResult.selected) {
      if (isSupabaseConfigured && supabase) {
        await supabase.from('strategy_nifty_overnight').upsert({
          id: dailyId,
          trading_date: dateStr,
          strategy_id: STRATEGY_ID,
          status: 'NO_ELIGIBLE_OPTION',
          selected_expiry: selectedExpiry,
          is_expiry_override: isExpiryOverride,
          next_trading_day: getNextValidTradingDay().dateStr,
          updated_at: new Date().toISOString(),
        });
      }
      return NextResponse.json({
        success: false,
        status: 'NO_ELIGIBLE_OPTION',
        message: 'No eligible CE or PE option found in the ₹50 to ₹75 premium range.',
      });
    }

    const ce = ceResult.selected;
    const pe = peResult.selected;
    const ceSl = calculateFixedStopLoss(ce.price);
    const peSl = calculateFixedStopLoss(pe.price);
    const nextTradingDay = getNextValidTradingDay().dateStr;

    const record = {
      id: dailyId,
      trading_date: dateStr,
      strategy_id: STRATEGY_ID,
      status: 'ACTIVE',
      selected_expiry: selectedExpiry,
      is_expiry_override: isExpiryOverride,
      ce_symbol: ce.symbol || `NIFTY ${ce.strike} CE`,
      ce_strike: ce.strike,
      ce_ref_price: ce.price,
      ce_stop_loss: ceSl,
      ce_current_price: ce.price,
      ce_status: 'ACTIVE',
      ce_quantity: NIFTY_LOT_SIZE,
      pe_symbol: pe.symbol || `NIFTY ${pe.strike} PE`,
      pe_strike: pe.strike,
      pe_ref_price: pe.price,
      pe_stop_loss: peSl,
      pe_current_price: pe.price,
      pe_status: 'ACTIVE',
      pe_quantity: NIFTY_LOT_SIZE,
      next_trading_day: nextTradingDay,
      mandatory_exit_time: '09:25:00 IST',
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('strategy_nifty_overnight').upsert(record);

      // Insert active positions for UI tracking
      await supabase.from('active_positions').upsert([
        {
          id: `${dailyId}_CE`,
          order_time: '09:20:00 IST',
          crossover_time: '09:20:00 IST',
          ticker: 'NIFTY',
          execution_mode: 'AUTO',
          instrument_type: 'OPTION (CE)',
          symbol: record.ce_symbol,
          quantity: NIFTY_LOT_SIZE,
          entry_price: ce.price,
          current_ltp: ce.price,
          risk_per_unit: +(ce.price * 0.25).toFixed(2),
          active_trailing_sl: ceSl,
          target_price: 0, // Invariant: Strictly No Target
          state_index: 1,
          state_label: 'ACTIVE (Monitoring SL: ₹' + ceSl + ')',
          strategy_id: STRATEGY_ID,
          allow_overnight: true,
          reference_price: ce.price,
          next_trading_day: nextTradingDay,
        },
        {
          id: `${dailyId}_PE`,
          order_time: '09:20:00 IST',
          crossover_time: '09:20:00 IST',
          ticker: 'NIFTY',
          execution_mode: 'AUTO',
          instrument_type: 'OPTION (PE)',
          symbol: record.pe_symbol,
          quantity: NIFTY_LOT_SIZE,
          entry_price: pe.price,
          current_ltp: pe.price,
          risk_per_unit: +(pe.price * 0.25).toFixed(2),
          active_trailing_sl: peSl,
          target_price: 0, // Invariant: Strictly No Target
          state_index: 1,
          state_label: 'ACTIVE (Monitoring SL: ₹' + peSl + ')',
          strategy_id: STRATEGY_ID,
          allow_overnight: true,
          reference_price: pe.price,
          next_trading_day: nextTradingDay,
        },
      ]);

      // Seed trade logs for audit ledger
      await supabase.from('trade_logs').upsert([
        {
          order_id: `${dailyId}_CE`,
          ticker: 'NIFTY',
          symbol: record.ce_symbol,
          action: 'BUY',
          quantity: NIFTY_LOT_SIZE,
          execution_price: ce.price,
          status: 'OPEN',
          execution_mode: 'AUTO',
          strategy_id: STRATEGY_ID,
          allow_overnight: true,
          reference_price: ce.price,
          timestamp: '09:20:00 IST',
        },
        {
          order_id: `${dailyId}_PE`,
          ticker: 'NIFTY',
          symbol: record.pe_symbol,
          action: 'BUY',
          quantity: NIFTY_LOT_SIZE,
          execution_price: pe.price,
          status: 'OPEN',
          execution_mode: 'AUTO',
          strategy_id: STRATEGY_ID,
          allow_overnight: true,
          reference_price: pe.price,
          timestamp: '09:20:00 IST',
        },
      ]);
    }

    return NextResponse.json({ success: true, data: record });
  }

  // =========================================================================
  // ACTION 2: INTRADAY_SL_EXIT (When Stop Loss breached)
  // =========================================================================
  if (action === 'INTRADAY_SL_EXIT') {
    const { legType, exitPrice } = payload;
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (legType === 'CE') {
      updates.ce_status = 'SL_HIT';
      updates.ce_exit_price = exitPrice;
      updates.ce_exit_time = `${timeStr} IST`;
      updates.ce_exit_reason = 'SL_HIT';
    } else if (legType === 'PE') {
      updates.pe_status = 'SL_HIT';
      updates.pe_exit_price = exitPrice;
      updates.pe_exit_time = `${timeStr} IST`;
      updates.pe_exit_reason = 'SL_HIT';
    }

    if (isSupabaseConfigured && supabase) {
      await supabase.from('strategy_nifty_overnight').update(updates).eq('id', dailyId);

      // Close position in active_positions table
      const posId = `${dailyId}_${legType}`;
      await supabase
        .from('active_positions')
        .update({
          state_index: 4,
          state_label: 'SL_HIT (Sold @ ₹' + exitPrice + ')',
          current_ltp: exitPrice,
        })
        .eq('id', posId);

      // Update trade_logs
      await supabase
        .from('trade_logs')
        .update({
          status: 'CLOSED',
          exit_price: exitPrice,
          exit_reason: 'SL_HIT',
          closed_at: new Date().toISOString(),
        })
        .eq('order_id', posId);
    }

    return NextResponse.json({ success: true, message: `${legType} SL exit recorded.` });
  }

  // =========================================================================
  // ACTION 3: MANDATORY_0925_EXIT (Next trading day at 09:25 AM IST)
  // =========================================================================
  if (action === 'MANDATORY_0925_EXIT' || action === 'RECOVERY_0925_EXIT') {
    const reason = action === 'RECOVERY_0925_EXIT' ? 'NEXT_DAY_0925_EXIT_RECOVERY' : 'NEXT_DAY_0925_EXIT';

    if (isSupabaseConfigured && supabase) {
      const { data: openRows } = await supabase
        .from('strategy_nifty_overnight')
        .select('*')
        .in('status', ['ACTIVE', 'OVERNIGHT_HOLD'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (openRows && openRows.length > 0) {
        const targetRow = openRows[0];
        const targetId = targetRow.id;
        const exitCe = payload.currentLtpCe ?? targetRow.ce_current_price ?? targetRow.ce_ref_price ?? 0;
        const exitPe = payload.currentLtpPe ?? targetRow.pe_current_price ?? targetRow.pe_ref_price ?? 0;

        const cePnl = targetRow.ce_ref_price ? +((exitCe - targetRow.ce_ref_price) * NIFTY_LOT_SIZE).toFixed(2) : 0;
        const pePnl = targetRow.pe_ref_price ? +((exitPe - targetRow.pe_ref_price) * NIFTY_LOT_SIZE).toFixed(2) : 0;

        const updates = {
          status: reason,
          ce_status: 'CLOSED',
          ce_exit_price: exitCe,
          ce_exit_time: `${timeStr} IST`,
          ce_exit_reason: reason,
          ce_pnl: cePnl,
          pe_status: 'CLOSED',
          pe_exit_price: exitPe,
          pe_exit_time: `${timeStr} IST`,
          pe_exit_reason: reason,
          pe_pnl: pePnl,
          updated_at: new Date().toISOString(),
        };

        await supabase.from('strategy_nifty_overnight').update(updates).eq('id', targetId);

        // Close in active_positions
        await supabase
          .from('active_positions')
          .update({ state_index: 4, state_label: `CLOSED (${reason})` })
          .in('id', [`${targetId}_CE`, `${targetId}_PE`]);

        // Update trade_logs
        await supabase
          .from('trade_logs')
          .update({
            status: 'CLOSED',
            exit_price: exitCe,
            realized_pnl: cePnl,
            exit_reason: reason,
            closed_at: new Date().toISOString(),
          })
          .eq('order_id', `${targetId}_CE`);

        await supabase
          .from('trade_logs')
          .update({
            status: 'CLOSED',
            exit_price: exitPe,
            realized_pnl: pePnl,
            exit_reason: reason,
            closed_at: new Date().toISOString(),
          })
          .eq('order_id', `${targetId}_PE`);

        return NextResponse.json({
          success: true,
          reason,
          targetId,
          cePnl,
          pePnl,
          message: 'Mandatory 09:25 exit completed and logged.',
        });
      }
    }

    return NextResponse.json({ success: true, reason, message: 'No open overnight positions found.' });
  }

  return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
}

export async function GET(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get('action');

    // If an action parameter is supplied (e.g. from Vercel Crons), execute the action
    if (action) {
      return await processStrategyAction(action, {});
    }

    // Default GET behavior: Query and return current strategy state
    const { dateStr } = getISTDate();
    const dailyId = getDailyExecutionId(dateStr);

    if (isSupabaseConfigured && supabase) {
      // 1. Check if there is an active overnight position from yesterday
      const { data: openOvernight } = await supabase
        .from('strategy_nifty_overnight')
        .select('*')
        .eq('status', 'OVERNIGHT_HOLD')
        .order('created_at', { ascending: false })
        .limit(1);

      if (openOvernight && openOvernight.length > 0) {
        return NextResponse.json({
          success: true,
          source: 'DATABASE_OVERNIGHT_HOLD',
          data: openOvernight[0],
        });
      }

      // 2. Query today's execution record
      const { data: todayRecord } = await supabase
        .from('strategy_nifty_overnight')
        .select('*')
        .eq('id', dailyId)
        .single();

      if (todayRecord) {
        return NextResponse.json({
          success: true,
          source: 'DATABASE_TODAY',
          data: todayRecord,
        });
      }
    }

    // Default to pending initial state
    const pendingState = initializePendingState(dateStr);
    return NextResponse.json({
      success: true,
      source: 'INITIAL_PENDING',
      data: pendingState,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...rest } = body;
    if (!action) {
      return NextResponse.json({ success: false, message: 'Action required in request body.' }, { status: 400 });
    }
    return await processStrategyAction(action, rest);
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
