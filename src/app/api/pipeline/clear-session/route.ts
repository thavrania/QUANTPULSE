import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { getISTDate } from '@/lib/services/marketHoursService';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handleClearSession(req);
}

export async function POST(req: NextRequest) {
  return handleClearSession(req);
}

async function handleClearSession(req: NextRequest) {
  try {
    const { dateStr, timeStr } = getISTDate();

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({
        success: true,
        message: 'Local memory session cleared (Supabase not configured or in standalone simulation mode).',
        timestamp: new Date().toISOString(),
      });
    }

    const client = supabase;

    // 1. Delete all active positions
    const { error: posErr } = await client
      .from('active_positions')
      .delete()
      .neq('id', 'DUMMY_NEVER_MATCH');

    if (posErr) {
      console.warn('Error clearing active_positions:', posErr.message);
    }

    // 2. Delete today's trade logs
    const { error: tradeErr } = await client
      .from('trade_logs')
      .delete()
      .gte('created_at', `${dateStr}T00:00:00`);

    if (tradeErr) {
      console.warn('Error clearing trade_logs:', tradeErr.message);
    }

    // 3. Delete today's TSL audit trail
    const { error: tslErr } = await client
      .from('tsl_audit_trail')
      .delete()
      .gte('created_at', `${dateStr}T00:00:00`);

    if (tslErr) {
      console.warn('Error clearing tsl_audit_trail:', tslErr.message);
    }

    // 4. Delete today's crossover events
    const { error: crossErr } = await client
      .from('crossover_events')
      .delete()
      .gte('created_at', `${dateStr}T00:00:00`);

    if (crossErr) {
      console.warn('Error clearing crossover_events:', crossErr.message);
    }

    // 5. Reset watchlist table: zero volume, reset crossover flags
    const { error: wlErr } = await client
      .from('watchlist')
      .update({
        today_vol_m: 0.0,
        has_crossed_20d: false,
        crossover_time: null,
        crossover_spot_price: null,
        updated_at: new Date().toISOString(),
      })
      .neq('ticker', 'DUMMY_NEVER_MATCH');

    if (wlErr) {
      console.warn('Error resetting watchlist:', wlErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `Clean slate activated at ${timeStr} IST (${dateStr}). All positions, trade logs, TSL trails, crossover events, and volume reset to zero.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error clearing session:', err);
    return NextResponse.json(
      { success: false, message: `Failed to clear session: ${err.message}` },
      { status: 500 }
    );
  }
}
