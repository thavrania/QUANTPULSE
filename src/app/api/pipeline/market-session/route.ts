import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { getISTDate, isTradingDay, getIndianMarketSession } from '@/lib/services/marketHoursService';

export const maxDuration = 60;

/**
 * GET: Retrieve persistent session state for today (or specified date)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    const { dateStr } = getISTDate();
    const targetDate = dateParam || dateStr;

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({
        success: true,
        source: 'LOCAL_MEMORY',
        session: null,
      });
    }

    const { data, error } = await supabase
      .from('market_session')
      .select('*')
      .eq('trading_date', targetDate)
      .maybeSingle();

    if (error) {
      console.warn('Error reading market_session from Supabase:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      source: 'SUPABASE',
      session: data,
    });
  } catch (err: any) {
    console.error('Market session GET handler error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: Create or Update market session state machine transition
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      market_state,
      initialization_status,
      live_sync_status,
      twenty_day_sync_status,
      live_feed_status,
      trade_mode,
      last_error,
      retry_increment,
      metadata,
    } = body;

    const { dateStr, timeStr } = getISTDate();
    const targetDate = body.trading_date || dateStr;

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({
        success: true,
        source: 'LOCAL_MEMORY',
        message: 'Supabase unconfigured, session transition acknowledged in local runtime.',
      });
    }

    const client = supabase;

    // Check if record exists
    const { data: existing } = await client
      .from('market_session')
      .select('*')
      .eq('trading_date', targetDate)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      updated_at: nowIso,
    };

    if (market_state) updatePayload.market_state = market_state;
    if (initialization_status) updatePayload.initialization_status = initialization_status;
    if (live_sync_status) updatePayload.live_sync_status = live_sync_status;
    if (twenty_day_sync_status) updatePayload.twenty_day_sync_status = twenty_day_sync_status;
    if (live_feed_status) updatePayload.live_feed_status = live_feed_status;
    if (trade_mode) updatePayload.trade_mode = trade_mode;
    if (last_error !== undefined) updatePayload.last_error = last_error;
    if (metadata) {
      updatePayload.metadata = existing?.metadata ? { ...existing.metadata, ...metadata } : metadata;
    }

    // Lifecycle timestamp triggers
    if (market_state === 'MARKET_OPEN_INITIALIZING' && !existing?.started_at) {
      updatePayload.started_at = nowIso;
    }
    if (market_state === 'LIVE_FEED_ACTIVE' && !existing?.live_feed_started_at) {
      updatePayload.live_feed_started_at = nowIso;
    }
    if (market_state === 'MARKET_CLOSED' && !existing?.live_feed_stopped_at) {
      updatePayload.live_feed_stopped_at = nowIso;
      updatePayload.completed_at = nowIso;
    }

    if (retry_increment) {
      updatePayload.retry_count = (existing?.retry_count || 0) + 1;
    }

    let savedResult;
    if (existing) {
      const { data, error } = await client
        .from('market_session')
        .update(updatePayload)
        .eq('trading_date', targetDate)
        .select()
        .single();
      if (error) throw error;
      savedResult = data;
    } else {
      const insertPayload = {
        trading_date: targetDate,
        market_state: market_state || 'PRE_MARKET',
        initialization_status: initialization_status || 'PENDING',
        live_sync_status: live_sync_status || 'PENDING',
        twenty_day_sync_status: twenty_day_sync_status || 'PENDING',
        live_feed_status: live_feed_status || 'STOPPED',
        trade_mode: trade_mode || 'AUTO',
        started_at: market_state === 'MARKET_OPEN_INITIALIZING' ? nowIso : null,
        created_at: nowIso,
        ...updatePayload,
      };
      const { data, error } = await client
        .from('market_session')
        .insert(insertPayload)
        .select()
        .single();
      if (error) throw error;
      savedResult = data;
    }

    return NextResponse.json({
      success: true,
      session: savedResult,
      timestamp: `${timeStr} IST`,
    });
  } catch (err: any) {
    console.error('Market session POST handler error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
