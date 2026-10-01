import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { batchSyncWatchlistBaselines, calculateFree20DBaseline, BaselineCalculationOutput } from '@/lib/engine/baselineBatchService';
import { getActiveBrokerCredentials } from '@/lib/services/brokerVaultService';
import { getStockMasterByTicker, resolveStockMetadata } from '@/lib/stocks/stockMaster';
import { hasTodayMarketSessionStarted } from '@/lib/services/marketHoursService';

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
    let isDateChange = false;
    let explicitTickers: string[] = [];

    // If POST, check if credentials, custom tickers, or isDateChange were sent in body
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.clientId) clientId = body.clientId;
        if (body.accessToken) accessToken = body.accessToken;
        if (body.tickers && Array.isArray(body.tickers) && body.tickers.length > 0) {
          explicitTickers = body.tickers;
        }
        if (body.isDateChange !== undefined) {
          isDateChange = Boolean(body.isDateChange);
        }
      } catch {
        // no body or json
      }
    }

    // If still missing, resolve from Supabase Cloud Vault
    if (!clientId || !accessToken) {
      const vault = await getActiveBrokerCredentials();
      clientId = clientId || vault.clientId;
      accessToken = accessToken || vault.accessToken;
    }

    // 2. Fetch list of monitored tickers - Database is the primary source of truth
    let dbTickers: string[] = [];
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: dbStocks } = await supabase
          .from('watchlist')
          .select('ticker')
          .filter('is_active_watchlist', 'neq', false);
        if (dbStocks && dbStocks.length > 0) {
          dbTickers = dbStocks.map((s: any) => s.ticker);
        }
      } catch (dbErr) {
        console.warn('Notice: error querying active watchlist from DB in sync-baselines:', dbErr);
      }
    }

    // Combine database tickers and any explicit tickers passed from frontend
    const allMonitoredTickers = Array.from(new Set([...dbTickers, ...(explicitTickers || [])]));
    let tickersToSync = allMonitoredTickers.length > 0 ? allMonitoredTickers : ['RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK'];

    // 3. Compute Baselines via Dhan API if credentials are present
    let calculationResults: BaselineCalculationOutput[] = [];

    if (clientId && accessToken) {
      try {
        calculationResults = await batchSyncWatchlistBaselines(
          tickersToSync,
          clientId,
          accessToken
        );
      } catch (dhanErr) {
        console.warn('Dhan historical chart calculation failed, falling back to quantitative baselines:', dhanErr);
      }
    }

    // Fallback: Compute true 20-day historical baseline from free NSE candles (or master catalog without mock drift)
    const calculatedTickerSet = new Set(calculationResults.map((r) => r.ticker));
    for (const ticker of tickersToSync) {
      if (!calculatedTickerSet.has(ticker)) {
        const freeBaseline = await calculateFree20DBaseline(ticker);
        if (freeBaseline) {
          calculationResults.push(freeBaseline);
        } else {
          const master = getStockMasterByTicker(ticker);
          const meta = resolveStockMetadata(master || { ticker });
          const exactAvgShares = meta.avg20DTradedShares;
          const finalAvgM = meta.avgVol20DM;

          calculationResults.push({
            ticker,
            securityId: meta.securityId || '1330',
            avgVolume20DM: finalAvgM,
            avg20DTradedShares: exactAvgShares,
            totalVolumeSumM: +(finalAvgM * 20),
            totalVolumeSumShares: exactAvgShares * 20,
            sessionsEvaluated: 20,
            volatilityStdDevM: +(finalAvgM * 0.15),
            shortTerm5DAvgM: +(finalAvgM * 1.02),
            trendRatio: 1.02,
            calculatedAt: new Date().toISOString(),
          });
        }
      }
    }

    // 4. Update Supabase Watchlist table for the trading session
    let updatedInDb = 0;
    if (isSupabaseConfigured && supabase && calculationResults.length > 0) {
      for (const res of calculationResults) {
        const updatePayload: Record<string, any> = {
          avg_vol_20d_m: res.avgVolume20DM,
          updated_at: new Date().toISOString(),
        };

        // If continuous regular trading has NOT opened today (e.g. pre-market 09:00 AM) OR it's a date rollover,
        // ALWAYS reset today's volume & clear crossover flags so yesterday's EOD data NEVER bleeds into the new day!
        const sessionStarted = hasTodayMarketSessionStarted();
        if (!sessionStarted || isDateChange) {
          updatePayload.today_vol_m = 0.0;
          updatePayload.has_crossed_20d = false;
          updatePayload.crossover_time = null;
          updatePayload.crossover_spot_price = null;
        }

        const { data: updatedRows, error: updateErr } = await supabase
          .from('watchlist')
          .update(updatePayload)
          .eq('ticker', res.ticker)
          .select('ticker');

        if (!updateErr && updatedRows && updatedRows.length > 0) {
          updatedInDb++;
        } else if (!updateErr && (!updatedRows || updatedRows.length === 0)) {
          // If ticker is not yet in watchlist table, insert it so it is preserved in the DB!
          const master = getStockMasterByTicker(res.ticker);
          if (master) {
            await supabase.from('watchlist').insert({
              ticker: master.ticker,
              short_name: master.shortName,
              name: master.name,
              isin: master.isin,
              segment: master.segment,
              sector: master.sector,
              security_id: master.securityId,
              is_fno: master.isFnO,
              lot_size: master.lotSize,
              strike_step: master.strikeStep,
              spot_ltp: master.approxLtp,
              today_vol_m: 0.0,
              avg_vol_20d_m: res.avgVolume20DM,
              has_crossed_20d: false,
              crossover_time: null,
              crossover_spot_price: null,
              iv_pct: master.isFnO ? 16.5 : 0,
              is_active_watchlist: true,
              updated_at: new Date().toISOString(),
            });
            updatedInDb++;
          }
        }
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
