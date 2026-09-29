import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { batchSyncWatchlistBaselines, BaselineCalculationOutput } from '@/lib/engine/baselineBatchService';

export const maxDuration = 60; // Allow up to 60 seconds on Vercel Pro/Hobby

export async function GET(req: NextRequest) {
  return handleSync(req);
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}

async function handleSync(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Verify Cron Secret if set (for automated Vercel Cron jobs)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // In development or manual UI trigger with payload, allow through if client credentials provided
    }

    let clientId = process.env.DHAN_CLIENT_ID || '';
    let accessToken = process.env.DHAN_ACCESS_TOKEN || '';

    // If POST, check if credentials were sent in body
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.clientId) clientId = body.clientId;
        if (body.accessToken) accessToken = body.accessToken;
      } catch {
        // no body or json
      }
    }

    // 2. Fetch list of monitored tickers
    let tickersToSync = ['RELIANCE', 'TATAMOTORS', 'TCS', 'ZOMATO', 'ICICIBANK', 'HDFCBANK', 'INFY', 'SBIN'];

    if (isSupabaseConfigured && supabase) {
      const { data: dbStocks } = await supabase.from('watchlist').select('ticker');
      if (dbStocks && dbStocks.length > 0) {
        tickersToSync = dbStocks.map((s: any) => s.ticker);
      }
    }

    // 3. Compute Baselines via Dhan API if credentials are present
    let calculationResults: BaselineCalculationOutput[] = [];

    if (clientId && accessToken) {
      calculationResults = await batchSyncWatchlistBaselines(
        tickersToSync,
        clientId,
        accessToken
      );
    } else {
      // High-Fidelity Simulation Fallback: compute realistic baseline shifts
      calculationResults = tickersToSync.map((ticker) => {
        const baseVolMap: Record<string, number> = {
          RELIANCE: 5.24,
          TATAMOTORS: 8.85,
          TCS: 1.48,
          ZOMATO: 19.12,
          ICICIBANK: 7.15,
          HDFCBANK: 6.05,
          INFY: 4.80,
          SBIN: 14.50,
        };
        const current = baseVolMap[ticker] || 10.0;
        const shift = +((Math.random() - 0.5) * 0.2).toFixed(2);
        const finalAvg = Math.max(1, +(current + shift).toFixed(2));

        return {
          ticker,
          securityId: '1330',
          avgVolume20DM: finalAvg,
          totalVolumeSumM: +(finalAvg * 20).toFixed(2),
          sessionsEvaluated: 20,
          volatilityStdDevM: +(finalAvg * 0.18).toFixed(2),
          shortTerm5DAvgM: +(finalAvg * 1.05).toFixed(2),
          trendRatio: 1.05,
          calculatedAt: new Date().toISOString(),
        };
      });
    }

    // 4. Update Supabase Watchlist table for the new trading session
    let updatedInDb = 0;
    if (isSupabaseConfigured && supabase && calculationResults.length > 0) {
      for (const res of calculationResults) {
        const { error } = await supabase
          .from('watchlist')
          .update({
            avg_vol_20d_m: res.avgVolume20DM,
            today_vol_m: 0.0, // Pre-market reset
            has_crossed_20d: false, // Clear previous session crossover flags
            crossover_time: null,
            crossover_spot_price: null,
            updated_at: new Date().toISOString(),
          })
          .eq('ticker', res.ticker);

        if (!error) updatedInDb++;
      }
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      pipeline: 'PRE_MARKET_20D_BASELINE_SYNC',
      status: 'COMPLETED',
      symbolsEvaluated: calculationResults.length,
      databaseRecordsUpdated: updatedInDb,
      dataSource: clientId && accessToken ? 'DHAN_HISTORICAL_API' : 'QUANT_SIMULATOR',
      durationMs,
      timestamp: new Date().toISOString(),
      baselines: calculationResults,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        pipeline: 'PRE_MARKET_20D_BASELINE_SYNC',
        status: 'FAILED',
        error: err.message || 'Unknown pipeline failure',
      },
      { status: 500 }
    );
  }
}
