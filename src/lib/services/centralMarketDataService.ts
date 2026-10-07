import {
  Stock,
  CentralMarketSnapshot,
  CentralFeedHealth,
  FeedHealthStatus,
  CrossoverEvent,
  LiveQuoteRecord,
} from '../types/quant';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { DHAN_BASE_URL, getDhanSecurityId } from '../broker/dhan/dhanConstants';
import { dhanApiClient } from '../broker/dhan/dhanApiClient';
import { dhanAuthService } from './dhanAuthService';
import { getActiveBrokerCredentials } from './brokerVaultService';
import { fetchFreeLiveQuotes } from '../market/freeLiveMarketService';
import {
  hasTodayMarketSessionStarted,
  getISTDate,
} from './marketHoursService';
import { checkAndLatchVolumeCrossover, formatClockIST } from '../engine/crossoverEngine';
import { formatCrossoverAlert, sendTelegramMessage } from '../alerts/telegramService';
import { getActiveAlertDestinations } from './alertSettingsService';
import {
  STOCK_MASTER_CATALOG,
  convertMasterToStock,
  getStockMasterByTicker,
  resolveStockMetadata,
  normalizeTicker,
} from '../stocks/stockMaster';

export class CentralMarketDataService {
  private snapshots = new Map<string, CentralMarketSnapshot>();
  private lastIngestionTimestamp = 0;
  private isIngesting = false;
  private inFlightPromise: Promise<Record<string, LiveQuoteRecord>> | null = null;
  private dispatchedAlertKeys = new Set<string>();
  private health: CentralFeedHealth = {
    status: 'DISCONNECTED',
    source: 'DHAN_HQ',
    lastSuccessfulUpdate: null,
    latencyMs: 0,
    errorCount: 0,
    lastError: null,
    updatedAt: new Date().toISOString(),
  };

  /**
   * Distributed Lease: Acquires or renews the central market feed leader lock.
   * Guarantees singleton ingestion even if multiple worker replicas exist.
   */
  public async acquireOrRenewLease(workerId: string, ttlSeconds: number = 15): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      return true; // Single-instance standalone mode
    }

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
      const nowIso = now.toISOString();

      // Check current lease
      const { data: existingLease } = await supabase
        .from('market_feed_leases')
        .select('*')
        .eq('lease_name', 'CENTRAL_MARKET_FEED')
        .maybeSingle();

      if (!existingLease) {
        // Insert new lease
        const { error } = await supabase.from('market_feed_leases').insert({
          lease_name: 'CENTRAL_MARKET_FEED',
          owner_id: workerId,
          expires_at: expiresAt,
          heartbeat_at: nowIso,
        });
        return !error;
      }

      const isExpired = new Date(existingLease.expires_at).getTime() < now.getTime();
      const isOwner = existingLease.owner_id === workerId;

      if (isOwner || isExpired) {
        const { error } = await supabase
          .from('market_feed_leases')
          .update({
            owner_id: workerId,
            expires_at: expiresAt,
            heartbeat_at: nowIso,
          })
          .eq('lease_name', 'CENTRAL_MARKET_FEED');

        return !error;
      }

      // Another active worker currently owns the valid lease
      return false;
    } catch (err: any) {
      console.warn('[CentralFeed] Lease acquisition error:', err.message);
      return false;
    }
  }

  /**
   * Releases lease on graceful worker shutdown
   */
  public async releaseLease(workerId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      await supabase
        .from('market_feed_leases')
        .delete()
        .eq('lease_name', 'CENTRAL_MARKET_FEED')
        .eq('owner_id', workerId);
    } catch (err) {
      console.warn('[CentralFeed] Lease release notice:', err);
    }
  }

  /**
   * Retrieves active monitored stocks from Supabase watchlist or full master catalog
   */
  public async getActiveWatchlistStocks(targetTickers?: string[]): Promise<Stock[]> {
    const stockMap = new Map<string, Stock>();

    // 1. Initialize complete 55-stock master universe
    STOCK_MASTER_CATALOG.forEach((master) => {
      stockMap.set(normalizeTicker(master.ticker), convertMasterToStock(master));
    });

    // 2. Query Supabase watchlist (safely, without breaking if is_active_watchlist does not exist)
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('watchlist').select('*');

        if (!error && Array.isArray(data) && data.length > 0) {
          data.forEach((d: any) => {
            if (!d.ticker) return;
            const norm = normalizeTicker(d.ticker);
            const master = getStockMasterByTicker(d.ticker);
            const meta = resolveStockMetadata(d, master);
            const existing = stockMap.get(norm);

            const avgShares =
              d.avg_20d_traded_shares !== null && d.avg_20d_traded_shares !== undefined
                ? Number(d.avg_20d_traded_shares)
                : d.avg_vol_20d_m !== null && d.avg_vol_20d_m !== undefined
                ? Math.round(Number(d.avg_vol_20d_m) * 1_000_000)
                : meta.avg20DTradedShares || Math.round((meta.avgVol20DM || 1.0) * 1_000_000);

            const avgVol =
              d.avg_vol_20d_m !== null && d.avg_vol_20d_m !== undefined
                ? Number(d.avg_vol_20d_m)
                : +(avgShares / 1_000_000).toFixed(6);

            const base: Stock = existing || convertMasterToStock(master || {
              ticker: d.ticker,
              name: d.name || d.ticker,
              isFnO: d.is_fno ?? true,
              lotSize: Number(d.lot_size) || 1,
              strikeStep: Number(d.strike_step) || 20,
              approxLtp: Number(d.spot_ltp) || 1000,
              avgVol20DM: avgVol,
              securityId: getDhanSecurityId(d.ticker),
              sector: d.sector || 'Equities',
            });

            stockMap.set(norm, {
              ...base,
              ticker: d.ticker,
              name: d.name || base.name,
              isFnO: d.is_fno ?? base.isFnO,
              lotSize: Number(d.lot_size) || base.lotSize || 1,
              strikeStep: Number(d.strike_step) || base.strikeStep || 20,
              spotLtp: Number(d.spot_ltp) || base.spotLtp,
              todayVolM: Number(d.today_vol_m) || 0,
              avgVol20DM: avgVol,
              todayTradedShares:
                d.today_traded_shares !== null && d.today_traded_shares !== undefined
                  ? Number(d.today_traded_shares)
                  : Math.round((Number(d.today_vol_m) || 0) * 1_000_000),
              avg20DTradedShares: avgShares,
              hasCrossed20D: Boolean(d.has_crossed_20d),
              crossoverTime: d.crossover_time || null,
              crossoverSpotPrice: d.crossover_spot_price ? Number(d.crossover_spot_price) : null,
              ivPct: Number(d.iv_pct) || base.ivPct || 16.5,
              dayHigh: d.day_high ? Number(d.day_high) : undefined,
              dayLow: d.day_low ? Number(d.day_low) : undefined,
              dayOpen: d.day_open ? Number(d.day_open) : undefined,
              dayClose: d.day_close ? Number(d.day_close) : undefined,
              changePct: d.change_pct !== undefined ? Number(d.change_pct) : undefined,
              feedSource: 'LIVE_DHAN',
            });
          });
        }
      } catch (err) {
        console.warn('[CentralFeed] Watchlist query notice:', err);
      }
    }

    // 3. If targetTickers explicitly provided, ensure all of them are included
    if (targetTickers && targetTickers.length > 0) {
      targetTickers.forEach((t) => {
        const norm = normalizeTicker(t);
        if (!stockMap.has(norm)) {
          const m = getStockMasterByTicker(t);
          if (m) stockMap.set(norm, convertMasterToStock(m));
        }
      });
      const requestedList: Stock[] = [];
      targetTickers.forEach((t) => {
        const s = stockMap.get(normalizeTicker(t));
        if (s) requestedList.push(s);
      });
      if (requestedList.length > 0) return requestedList;
    }

    return Array.from(stockMap.values());
  }

  /**
   * Main Centralized Market Data Ingestion Pipeline.
   * Single authoritative entry point for upstream feed requests.
   */
  public async ingestMarketTick(
    workerId: string = 'CENTRAL_WORKER',
    targetTickers?: string[]
  ): Promise<{
    count: number;
    source: string;
    latencyMs: number;
    quotes: Record<string, LiveQuoteRecord>;
  }> {
    const startTime = Date.now();
    const currentStocks = await this.getActiveWatchlistStocks(targetTickers);
    const tickerList = currentStocks.map((s) => s.ticker);

    const authStatus = await dhanAuthService.getAuthStatus();
    let quotes: Record<string, LiveQuoteRecord> = {};
    let feedSource = 'DHAN_HQ';
    let feedStatus: FeedHealthStatus = 'CONNECTED';
    let lastError: string | null = null;

    // 1. Fetch from Dhan or fallback
    if (!authStatus.isConfigured) {
      quotes = await fetchFreeLiveQuotes(tickerList);
      feedSource = 'FREE_NSE_LIVE';
      feedStatus = 'FALLBACK';
    } else {
      const securityIds = tickerList.map((t) => parseInt(getDhanSecurityId(t), 10));

      try {
        const response = await dhanApiClient.request('/marketfeed/quote', {
          method: 'POST',
          body: JSON.stringify({ NSE_EQ: securityIds }),
        });

        if (!response.ok) {
          lastError = response.error || `Dhan HTTP ${response.status}`;
          console.warn(`[CentralFeed] Dhan rejected (${response.status}). Switching to Free Yahoo fallback.`);
          quotes = await fetchFreeLiveQuotes(tickerList);
          feedSource = 'FREE_NSE_LIVE';
          feedStatus = 'FALLBACK';
        } else {
          const quoteData = response.data;
          const nseData = quoteData?.data?.NSE_EQ || {};
          const sessionStarted = hasTodayMarketSessionStarted();
          const istNow = getISTDate();
          const secsSinceOpen = (istNow.hours * 3600 + istNow.minutes * 60 + istNow.seconds) - (9 * 3600 + 15 * 60);

          tickerList.forEach((sym) => {
            const secId = getDhanSecurityId(sym);
            const item = nseData[secId];
            if (item) {
              const ltp = item.last_price || item.close || 0;
              const close = item.close || ltp;
              const calcChange = close > 0 ? +(((ltp - close) / close) * 100).toFixed(2) : 0;

              // Sanitization: Verify trade timestamp is genuinely from today's regular session (>= 09:15 IST)
              let isTradeFromToday = true;
              if (item.last_trade_time) {
                const tVal = item.last_trade_time;
                const epochMs =
                  typeof tVal === 'number'
                    ? tVal < 1e11 ? tVal * 1000 : tVal
                    : Date.parse(String(tVal));
                if (!isNaN(epochMs)) {
                  const tradeDate = getISTDate(new Date(epochMs));
                  isTradeFromToday =
                    tradeDate.dateStr === istNow.dateStr &&
                    tradeDate.hours * 60 + tradeDate.minutes >= 9 * 60 + 15;
                }
              }

              let rawVol = sessionStarted && isTradeFromToday ? (item.volume || 0) : 0;

              // 09:15:00 - 09:15:59 Opening stabilization gate
              if (secsSinceOpen >= 0 && secsSinceOpen < 60 && rawVol > 500_000 && !isTradeFromToday) {
                rawVol = 0;
              }

              quotes[sym] = {
                ltp: +ltp.toFixed(2),
                volumeM: rawVol / 1_000_000,
                volume: rawVol,
                high: +(item.high || ltp).toFixed(2),
                low: +(item.low || ltp).toFixed(2),
                open: +(item.open || ltp).toFixed(2),
                close: +(close).toFixed(2),
                changePct: item.change_percent !== undefined ? +item.change_percent.toFixed(2) : calcChange,
                averagePrice: item.average_price ? +(item.average_price).toFixed(2) : undefined,
              };
            }
          });

          if (Object.keys(quotes).length === 0) {
            quotes = await fetchFreeLiveQuotes(tickerList);
            feedSource = 'FREE_NSE_LIVE';
            feedStatus = 'FALLBACK';
          }
        }
      } catch (dhanErr: any) {
        lastError = dhanErr.message;
        console.warn('[CentralFeed] Dhan exception. Falling back to Free Live:', dhanErr.message);
        quotes = await fetchFreeLiveQuotes(tickerList);
        feedSource = 'FREE_NSE_LIVE';
        feedStatus = 'DEGRADED';
      }
    }

    const latencyMs = Date.now() - startTime;
    const nowIso = new Date().toISOString();
    const clockTime = formatClockIST(getISTDate().hours * 3600 + getISTDate().minutes * 60 + getISTDate().seconds);
    const todayDateStr = getISTDate().dateStr;

    // 2. Evaluate crossovers, build snapshots, and dispatch alerts
    const snapshotsToPersist: any[] = [];
    const watchlistUpdatesToPersist: Array<{ ticker: string; updates: any }> = [];

    for (const stock of currentStocks) {
      const q = quotes[stock.ticker];
      if (!q) continue;

      const updatedShares = q.volume !== undefined ? q.volume : (stock.todayTradedShares ?? Math.round(q.volumeM * 1_000_000));
      const updatedVolM = q.volumeM !== undefined ? q.volumeM : updatedShares / 1_000_000;
      const avgShares = stock.avg20DTradedShares || Math.round(stock.avgVol20DM * 1_000_000);

      const workingStock: Stock = {
        ...stock,
        spotLtp: q.ltp || stock.spotLtp,
        todayVolM: updatedVolM,
        todayTradedShares: updatedShares,
        avg20DTradedShares: avgShares,
        dayHigh: q.high || stock.dayHigh,
        dayLow: q.low || stock.dayLow,
        dayOpen: q.open || stock.dayOpen,
        dayClose: q.close || stock.dayClose,
        changePct: q.changePct ?? stock.changePct,
        feedSource: 'LIVE_DHAN',
      };

      // Evaluate 20D volume crossover invariant
      const { newlyCrossed, event } = checkAndLatchVolumeCrossover(workingStock, clockTime);

      if (newlyCrossed && event) {
        workingStock.hasCrossed20D = true;
        workingStock.crossoverTime = event.time;
        workingStock.crossoverSpotPrice = event.crossPrice;

        // Perform server-side idempotent alert dispatch
        await this.handleServerCrossoverAlert(workingStock, event, todayDateStr);
      }

      const snapshot: CentralMarketSnapshot = {
        ticker: workingStock.ticker,
        securityId: getDhanSecurityId(workingStock.ticker),
        ltp: workingStock.spotLtp,
        open: workingStock.dayOpen || workingStock.spotLtp,
        high: workingStock.dayHigh || workingStock.spotLtp,
        low: workingStock.dayLow || workingStock.spotLtp,
        previousClose: workingStock.dayClose || workingStock.spotLtp,
        changePct: workingStock.changePct || 0,
        todayTradedShares: updatedShares,
        todayVolumeM: updatedVolM,
        avgVol20DM: workingStock.avgVol20DM,
        avg20DTradedShares: avgShares,
        averagePrice: q.averagePrice || workingStock.spotLtp,
        lastTradeTime: nowIso,
        source: feedSource,
        feedStatus,
        hasCrossed20D: workingStock.hasCrossed20D,
        crossoverTime: workingStock.crossoverTime,
        crossoverSpotPrice: workingStock.crossoverSpotPrice,
        timestampIst: clockTime,
        receivedAt: nowIso,
        updatedAt: nowIso,
      };

      this.snapshots.set(workingStock.ticker, snapshot);

      snapshotsToPersist.push({
        ticker: snapshot.ticker,
        timestamp_ist: snapshot.timestampIst,
        spot_ltp: snapshot.ltp,
        today_vol_m: snapshot.todayVolumeM,
        avg_vol_20d_m: snapshot.avgVol20DM,
        rvol_ratio: snapshot.avgVol20DM > 0 ? +(snapshot.todayVolumeM / snapshot.avgVol20DM).toFixed(2) : 1.0,
      });

      watchlistUpdatesToPersist.push({
        ticker: workingStock.ticker,
        updates: {
          spot_ltp: workingStock.spotLtp,
          today_vol_m: workingStock.todayVolM,
          has_crossed_20d: workingStock.hasCrossed20D,
          crossover_time: workingStock.crossoverTime,
          crossover_spot_price: workingStock.crossoverSpotPrice,
          day_high: workingStock.dayHigh,
          day_low: workingStock.dayLow,
          day_open: workingStock.dayOpen,
          day_close: workingStock.dayClose,
          change_pct: workingStock.changePct,
          updated_at: nowIso,
        },
      });
    }

    // 3. Persist snapshots and watchlist updates to Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        if (snapshotsToPersist.length > 0) {
          // Attempt tick snapshot persistence safely
          Promise.resolve(
            supabase.from('live_tick_snapshots').upsert(snapshotsToPersist)
          ).catch(() => {});
        }

        for (const item of watchlistUpdatesToPersist) {
          Promise.resolve(
            supabase.from('watchlist').update(item.updates).eq('ticker', item.ticker)
          ).catch(() => {});
        }

        // Update health table safely
        this.health = {
          status: feedStatus,
          source: feedSource,
          lastSuccessfulUpdate: nowIso,
          latencyMs,
          errorCount: lastError ? this.health.errorCount + 1 : 0,
          lastError,
          workerId,
          updatedAt: nowIso,
        };

        Promise.resolve(
          supabase.from('market_feed_health').upsert({
            id: 'FEED_HEALTH',
            status: this.health.status,
            source: this.health.source,
            last_successful_update: this.health.lastSuccessfulUpdate,
            latency_ms: this.health.latencyMs,
            error_count: this.health.errorCount,
            last_error: this.health.lastError,
            worker_id: workerId,
            updated_at: nowIso,
          }, { onConflict: 'id' })
        ).catch(() => {});
      } catch (persistErr: any) {
        console.warn('[CentralFeed] Cloud state persistence notice:', persistErr.message);
      }
    }

    this.lastIngestionTimestamp = Date.now();
    return {
      count: Object.keys(quotes).length,
      source: feedSource,
      latencyMs,
      quotes,
    };
  }

  /**
   * Dispatches server-side crossover alerts with deterministic deduplication
   */
  private async handleServerCrossoverAlert(
    stock: Stock,
    event: CrossoverEvent,
    todayDateStr: string
  ): Promise<void> {
    const eventKey = `CROSSOVER:${stock.ticker}:${todayDateStr}`;

    // 1. Strict in-memory lock: Drop immediate re-triggers in this server process
    if (this.dispatchedAlertKeys.has(eventKey)) {
      return;
    }

    // 2. Database deduplication via crossover_events table (unique index on ticker + day)
    let isAlreadyRecordedInDb = false;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: existingEvent } = await supabase
          .from('crossover_events')
          .select('id')
          .eq('ticker', stock.ticker)
          .gte('created_at', `${todayDateStr}T00:00:00`)
          .limit(1);

        if (existingEvent && existingEvent.length > 0) {
          isAlreadyRecordedInDb = true;
        } else {
          await supabase.from('crossover_events').insert({
            ticker: stock.ticker,
            time_ist: event.time,
            avg_vol_20d_m: event.avgVol20DM,
            cross_price: event.crossPrice,
            is_fno: event.isFnO,
          });
        }
      } catch (err) {
        console.warn('[CentralFeed] Crossover DB record notice:', err);
      }
    }

    // 3. Resolve active alert destinations
    const destinations = await getActiveAlertDestinations('CROSSOVER');
    if (destinations.length === 0) {
      this.dispatchedAlertKeys.add(eventKey);
      return;
    }

    const alertMessage = formatCrossoverAlert(
      stock.ticker,
      stock.todayVolM,
      stock.avgVol20DM,
      stock.spotLtp,
      event.time,
      stock.todayTradedShares,
      stock.avg20DTradedShares,
      event.signalType || 'BUY'
    );

    for (const dest of destinations) {
      if (!dest.botToken || !dest.chatId) continue;
      const destKey = `${eventKey}:${dest.chatId}`;

      // Drop duplicate dispatch to this destination
      if (this.dispatchedAlertKeys.has(destKey)) continue;

      try {
        const sendRes = await sendTelegramMessage(dest.botToken, dest.chatId, alertMessage);
        if (sendRes.success) {
          this.dispatchedAlertKeys.add(destKey);
          this.dispatchedAlertKeys.add(eventKey);

          // If alert_dispatch_logs table exists, record log (swallow error if table missing)
          if (isSupabaseConfigured && supabase) {
            Promise.resolve(
              supabase.from('alert_dispatch_logs').insert({
                event_key: eventKey,
                event_type: 'CROSSOVER',
                ticker: stock.ticker,
                destination_chat_id: dest.chatId,
                payload: {
                  spotLtp: stock.spotLtp,
                  todayVolM: stock.todayVolM,
                  time: event.time,
                },
              })
            ).catch(() => {});
          }
        }
      } catch (err: any) {
        console.warn(`[CentralFeed] Alert dispatch error for ${dest.chatId}:`, err.message);
      }
    }
  }

  /**
   * Returns fresh quotes for requested tickers.
   * If memory/DB snapshots are recent (< 2,500ms), serves them directly without calling Dhan!
   * Collapses multiple concurrent browser requests into one single in-flight tick.
   */
  public async getQuotesOrRefresh(
    tickers?: string[]
  ): Promise<{
    quotes: Record<string, LiveQuoteRecord>;
    source: string;
    isFresh: boolean;
    timestamp: string;
  }> {
    const now = Date.now();
    const isFresh = now - this.lastIngestionTimestamp < 2500 && this.snapshots.size > 0;

    // 1. If memory cache is fresh AND contains all requested tickers, return immediately
    if (isFresh) {
      const quotesMap: Record<string, LiveQuoteRecord> = {};
      const targetTickers = tickers && tickers.length > 0 ? tickers : Array.from(this.snapshots.keys());
      let hasMissing = false;

      targetTickers.forEach((ticker) => {
        const snap = this.snapshots.get(ticker) || this.snapshots.get(normalizeTicker(ticker));
        if (snap) {
          quotesMap[ticker] = {
            ltp: snap.ltp,
            volumeM: snap.todayVolumeM,
            volume: snap.todayTradedShares,
            high: snap.high,
            low: snap.low,
            open: snap.open,
            close: snap.previousClose,
            changePct: snap.changePct,
            averagePrice: snap.averagePrice,
          };
        } else {
          hasMissing = true;
        }
      });

      if (!hasMissing && Object.keys(quotesMap).length > 0) {
        return {
          quotes: quotesMap,
          source: this.health.source,
          isFresh: true,
          timestamp: new Date(this.lastIngestionTimestamp).toISOString(),
        };
      }
    }

    // 2. Coalesce in-flight ingestion ticks
    if (this.inFlightPromise) {
      const quotes = await this.inFlightPromise;
      return {
        quotes,
        source: this.health.source,
        isFresh: true,
        timestamp: new Date(this.lastIngestionTimestamp).toISOString(),
      };
    }

    // 3. Run single centralized tick with requested tickers
    this.inFlightPromise = (async () => {
      try {
        const result = await this.ingestMarketTick('API_REQUEST', tickers);
        return result.quotes;
      } finally {
        this.inFlightPromise = null;
      }
    })();

    const quotes = await this.inFlightPromise;
    return {
      quotes,
      source: this.health.source,
      isFresh: false,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Retrieves feed health summary
   */
  public async getFeedHealth(): Promise<CentralFeedHealth> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('market_feed_health')
          .select('*')
          .eq('id', 'FEED_HEALTH')
          .maybeSingle();

        if (data) {
          return {
            status: data.status,
            source: data.source,
            lastSuccessfulUpdate: data.last_successful_update,
            latencyMs: data.latency_ms || 0,
            errorCount: data.error_count || 0,
            lastError: data.last_error,
            workerId: data.worker_id,
            activeSubscribers: data.active_subscribers,
            updatedAt: data.updated_at,
          };
        }
      } catch {}
    }

    return this.health;
  }

  /**
   * Propagates authoritative database-stored 20D baselines to memory snapshots
   */
  public updateBaselinesFromDatabase(
    baselines: Array<{ ticker: string; avgVol20DM: number; avg20DTradedShares: number }>
  ): void {
    for (const b of baselines) {
      const sym = b.ticker.toUpperCase();
      const existing = this.snapshots.get(sym);
      if (existing) {
        existing.avgVol20DM = b.avgVol20DM;
        existing.avg20DTradedShares = b.avg20DTradedShares;
        this.snapshots.set(sym, existing);
      }
    }
  }
}

// Global Singleton Instance
export const centralMarketDataService = new CentralMarketDataService();
