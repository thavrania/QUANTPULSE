import { Stock, CrossoverEvent } from '@/lib/types/quant';
import { checkAndLatchVolumeCrossover } from '@/lib/engine/crossoverEngine';
import { logBatchTickSnapshotsToCloud } from '@/lib/services/supabaseTelemetryService';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export interface IngestionTelemetry {
  packetsReceived: number;
  lastLatencyMs: number;
  lastSyncTimestamp: string;
  errorCount: number;
  streamActive: boolean;
  pulseIntervalMs: number;
}

export interface IngestionResult {
  updatedWatchlist: Stock[];
  newCrossovers: CrossoverEvent[];
  snapshotsToLog: {
    ticker: string;
    timestamp_ist: string;
    spot_ltp: number;
    today_vol_m: number;
    avg_vol_20d_m: number;
    rvol_ratio: number;
  }[];
}

/**
 * Ingestion processor that maps incoming live Dhan HQ batch quotes to watchlist stocks,
 * evaluates 20D volume crossovers, and prepares periodic audit snapshots.
 */
export function processLiveMarketfeedBatch(
  currentWatchlist: Stock[],
  quotesMap: Record<string, any>,
  clockTimeIST: string,
  shouldLogSnapshot: boolean = false
): IngestionResult {
  const newCrossovers: CrossoverEvent[] = [];
  const snapshotsToLog: IngestionResult['snapshotsToLog'] = [];

  const updatedWatchlist = currentWatchlist.map((stock) => {
    const q = quotesMap[stock.ticker];
    if (!q) return stock;

    const spotLtp = Number(q.ltp) || stock.spotLtp;
    const todayVolM = q.volumeM !== undefined ? Number(q.volumeM) : stock.todayVolM;
    const dayHigh = q.high !== undefined ? Number(q.high) : stock.dayHigh;
    const dayLow = q.low !== undefined ? Number(q.low) : stock.dayLow;
    const dayOpen = q.open !== undefined ? Number(q.open) : stock.dayOpen;
    const dayClose = q.close !== undefined ? Number(q.close) : stock.dayClose;
    const changePct = q.changePct !== undefined ? Number(q.changePct) : stock.changePct;

    const updated: Stock = {
      ...stock,
      spotLtp,
      todayVolM,
      dayHigh,
      dayLow,
      dayOpen,
      dayClose,
      changePct,
      feedSource: 'LIVE_DHAN',
    };

    // Evaluate 20-Day Cumulative Volume Crossover
    const { newlyCrossed, event } = checkAndLatchVolumeCrossover(updated, clockTimeIST);
    if (newlyCrossed && event) {
      newCrossovers.push(event);

      // Immediately persist crossover flag in Supabase
      if (isSupabaseConfigured && supabase) {
        supabase
          .from('crossover_events')
          .insert({
            ticker: event.ticker,
            time_ist: event.time,
            avg_vol_20d_m: event.avgVol20DM,
            cross_price: event.crossPrice,
            is_fno: event.isFnO,
          })
          .then();

        supabase
          .from('watchlist')
          .update({
            has_crossed_20d: true,
            crossover_time: event.time,
            crossover_spot_price: event.crossPrice,
          })
          .eq('ticker', event.ticker)
          .then();
      }
    }

    // Prepare periodic audit snapshot for Supabase telemetry
    if (shouldLogSnapshot && spotLtp > 0) {
      const rvolRatio = stock.avgVol20DM > 0 ? +(todayVolM / stock.avgVol20DM).toFixed(2) : 1.0;
      snapshotsToLog.push({
        ticker: stock.ticker,
        timestamp_ist: clockTimeIST,
        spot_ltp: spotLtp,
        today_vol_m: todayVolM,
        avg_vol_20d_m: stock.avgVol20DM,
        rvol_ratio: rvolRatio,
      });
    }

    return updated;
  });

  // Flush snapshots asynchronously if any
  if (snapshotsToLog.length > 0) {
    logBatchTickSnapshotsToCloud(snapshotsToLog).catch(() => {});
  }

  return {
    updatedWatchlist,
    newCrossovers,
    snapshotsToLog,
  };
}
