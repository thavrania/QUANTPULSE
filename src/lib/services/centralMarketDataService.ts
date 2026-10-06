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
import { getActiveBrokerCredentials } from './brokerVaultService';
import { fetchFreeLiveQuotes } from '../market/freeLiveMarketService';
import {
  hasTodayMarketSessionStarted,
  getISTDate,
} from './marketHoursService';
import { checkAndLatchVolumeCrossover, formatClockIST } from '../engine/crossoverEngine';
import { formatCrossoverAlert, sendTelegramMessage } from '../alerts/telegramService';
import { getActiveAlertDestinations } from './alertSettingsService';

export class CentralMarketDataService {
  private snapshots = new Map<string, CentralMarketSnapshot>();
  private lastIngestionTimestamp = 0;
  private isIngesting = false;
  private inFlightPromise: Promise<Record<string, LiveQuoteRecord>> | null = null;
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
   * Retrieves active monitored stocks from Supabase watchlist
   */
  public async getActiveWatchlistStocks(): Promise<Stock[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('watchlist')
          .select('*')
          .neq('is_active_watchlist', false);

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((d: any) => ({
            ticker: d.ticker,
            shortName: d.short_name,
            name: d.name,
            isFnO: d.is_fno ?? true,
            segment: d.segment,
            sector: d.sector,
            securityId: d.security_id,
            isin: d.isin,
            lotSize: d.lot_size || 1,
            strikeStep: Number(d.strike_step) || 20,
            spotLtp: Number(d.spot_ltp) || 0,
            todayVolM: Number(d.today_vol_m) || 0,
            avgVol20DM: Number(d.avg_vol_20d_m) || 0,
            todayTradedShares: d.today_traded_shares !== null && d.today_traded_shares !== undefined ? Number(d.today_traded_shares) : Math.round((Number(d.today_vol_m) || 0) * 1_000_000),
            avg20DTradedShares: d.avg_20d_traded_shares !== null && d.avg_20d_traded_shares !== undefined ? Number(d.avg_20d_traded_shares) : Math.round((Number(d.avg_vol_20d_m) || 0) * 1_000_000),
            hasCrossed20D: Boolean(d.has_crossed_20d),
            crossoverTime: d.crossover_time || null,
            crossoverSpotPrice: d.crossover_spot_price ? Number(d.crossover_spot_price) : null,
            ivPct: Number(d.iv_pct) || 16.5,
            dayHigh: Number(d.day_high) || Number(d.spot_ltp) || 0,
            dayLow: Number(d.day_low) || Number(d.spot_ltp) || 0,
            dayOpen: Number(d.day_open) || Number(d.spot_ltp) || 0,
            dayClose: Number(d.day_close) || Number(d.spot_ltp) || 0,
            changePct: Number(d.change_pct) || 0,
            feedSource: 'LIVE_DHAN',
          }));
        }
      } catch (err) {
        console.warn('[CentralFeed] Watchlist query notice:', err);
      }
    }

    // Default fallback constituent list
    return [
      { ticker: 'RELIANCE', name: 'Reliance Industries Limited', spotLtp: 2968.50, todayVolM: 0, avgVol20DM: 5.20, isFnO: true, lotSize: 250, strikeStep: 50, hasCrossed20D: false, crossoverTime: null, crossoverSpotPrice: null, ivPct: 18.4 },
      { ticker: 'TMCV', name: 'TMCV', spotLtp: 984.40, todayVolM: 0, avgVol20DM: 8.90, isFnO: true, lotSize: 550, strikeStep: 20, hasCrossed20D: false, crossoverTime: null, crossoverSpotPrice: null, ivPct: 23.8 },
      { ticker: 'TCS', name: 'Tata Consultancy Services Limited', spotLtp: 4126.00, todayVolM: 0, avgVol20DM: 1.50, isFnO: true, lotSize: 175, strikeStep: 50, hasCrossed20D: false, crossoverTime: null, crossoverSpotPrice: null, ivPct: 16.2 },
      { ticker: 'INFY', name: 'Infosys Limited', spotLtp: 1912.00, todayVolM: 0, avgVol20DM: 4.80, isFnO: true, lotSize: 400, strikeStep: 20, hasCrossed20D: false, crossoverTime: null, crossoverSpotPrice: null, ivPct: 17.5 },
      { ticker: 'HDFCBANK', name: 'HDFC Bank Limited', spotLtp: 1644.20, todayVolM: 0, avgVol20DM: 6.00, isFnO: true, lotSize: 550, strikeStep: 20, hasCrossed20D: false, crossoverTime: null, crossoverSpotPrice: null, ivPct: 14.9 },
      { ticker: 'ICICIBANK', name: 'ICICI Bank Limited', spotLtp: 1258.00, todayVolM: 0, avgVol20DM: 7.00, isFnO: true, lotSize: 700, strikeStep: 20, hasCrossed20D: false, crossoverTime: null, crossoverSpotPrice: null, ivPct: 15.6 },
    ];
  }

  /**
   * Main Centralized Market Data Ingestion Pipeline.
   * Single authoritative entry point for upstream feed requests.
   */
  public async ingestMarketTick(workerId: string = 'CENTRAL_WORKER'): Promise<{
    count: number;
    source: string;
    latencyMs: number;
    quotes: Record<string, LiveQuoteRecord>;
  }> {
    const startTime = Date.now();
    const currentStocks = await this.getActiveWatchlistStocks();
    const tickerList = currentStocks.map((s) => s.ticker);

    const vault = await getActiveBrokerCredentials();
    const cid = vault.clientId;
    const token = vault.accessToken;

    let quotes: Record<string, LiveQuoteRecord> = {};
    let feedSource = 'DHAN_HQ';
    let feedStatus: FeedHealthStatus = 'CONNECTED';
    let lastError: string | null = null;

    // 1. Fetch from Dhan or fallback
    if (!cid || !token) {
      quotes = await fetchFreeLiveQuotes(tickerList);
      feedSource = 'FREE_NSE_LIVE';
      feedStatus = 'FALLBACK';
    } else {
      const securityIds = tickerList.map((t) => parseInt(getDhanSecurityId(t), 10));

      try {
        const response = await fetch(`${DHAN_BASE_URL}/marketfeed/quote`, {
          method: 'POST',
          headers: {
            'access-token': token,
            'client-id': cid,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ NSE_EQ: securityIds }),
          cache: 'no-store',
        });

        if (!response.ok) {
          const errText = await response.text();
          lastError = `Dhan ${response.status}: ${errText}`;
          console.warn(`[CentralFeed] Dhan rejected (${response.status}). Switching to Free Yahoo fallback.`);
          quotes = await fetchFreeLiveQuotes(tickerList);
          feedSource = 'FREE_NSE_LIVE';
          feedStatus = 'FALLBACK';
        } else {
          const quoteData = await response.json();
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
        security_id: snapshot.securityId,
        ltp: snapshot.ltp,
        open: snapshot.open,
        high: snapshot.high,
        low: snapshot.low,
        previous_close: snapshot.previousClose,
        change_pct: snapshot.changePct,
        today_traded_shares: snapshot.todayTradedShares,
        today_volume_m: snapshot.todayVolumeM,
        avg_vol_20d_m: snapshot.avgVol20DM,
        avg_20d_traded_shares: snapshot.avg20DTradedShares,
        average_price: snapshot.averagePrice,
        source: snapshot.source,
        feed_status: snapshot.feedStatus,
        has_crossed_20d: snapshot.hasCrossed20D,
        crossover_time: snapshot.crossoverTime,
        crossover_spot_price: snapshot.crossoverSpotPrice,
        timestamp_ist: snapshot.timestampIst,
        rvol_ratio: snapshot.avgVol20DM > 0 ? +(snapshot.todayVolumeM / snapshot.avgVol20DM).toFixed(2) : 1.0,
        received_at: snapshot.receivedAt,
        updated_at: snapshot.updatedAt,
      });

      watchlistUpdatesToPersist.push({
        ticker: workingStock.ticker,
        updates: {
          spot_ltp: workingStock.spotLtp,
          today_vol_m: workingStock.todayVolM,
          today_traded_shares: workingStock.todayTradedShares,
          has_crossed_20d: workingStock.hasCrossed20D,
          crossover_time: workingStock.crossoverTime,
          crossover_spot_price: workingStock.crossoverSpotPrice,
          change_pct: workingStock.changePct,
          updated_at: nowIso,
        },
      });
    }

    // 3. Persist snapshots to Supabase (Upsert on ticker)
    if (isSupabaseConfigured && supabase && snapshotsToPersist.length > 0) {
      try {
        await supabase
          .from('live_tick_snapshots')
          .upsert(snapshotsToPersist, { onConflict: 'ticker' });

        for (const item of watchlistUpdatesToPersist) {
          await supabase.from('watchlist').update(item.updates).eq('ticker', item.ticker);
        }

        // Update health table
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

        await supabase.from('market_feed_health').upsert({
          id: 'FEED_HEALTH',
          status: this.health.status,
          source: this.health.source,
          last_successful_update: this.health.lastSuccessfulUpdate,
          latency_ms: this.health.latencyMs,
          error_count: this.health.errorCount,
          last_error: this.health.lastError,
          worker_id: workerId,
          updated_at: nowIso,
        }, { onConflict: 'id' });
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

    if (isSupabaseConfigured && supabase) {
      try {
        // Record crossover event in audit log if not present
        const { data: existingEvent } = await supabase
          .from('crossover_events')
          .select('id')
          .eq('ticker', stock.ticker)
          .gte('created_at', `${todayDateStr}T00:00:00`)
          .limit(1);

        if (!existingEvent || existingEvent.length === 0) {
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

    // Resolve destinations configured for crossover notifications
    const destinations = await getActiveAlertDestinations('CROSSOVER');
    if (destinations.length === 0) return;

    const alertMessage = formatCrossoverAlert(
      stock.ticker,
      stock.todayVolM,
      stock.avgVol20DM,
      stock.spotLtp,
      event.time,
      stock.todayTradedShares,
      stock.avg20DTradedShares
    );

    for (const dest of destinations) {
      if (!dest.botToken || !dest.chatId) continue;

      // Deterministic deduplication check: (eventKey, destinationChatId)
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: existingLog } = await supabase
            .from('alert_dispatch_logs')
            .select('id')
            .eq('event_key', eventKey)
            .eq('destination_chat_id', dest.chatId)
            .maybeSingle();

          if (existingLog) {
            // Already dispatched to this destination
            continue;
          }

          // Dispatch to Telegram
          const sendRes = await sendTelegramMessage(dest.botToken, dest.chatId, alertMessage);
          if (sendRes.success) {
            await supabase.from('alert_dispatch_logs').insert({
              event_key: eventKey,
              event_type: 'CROSSOVER',
              ticker: stock.ticker,
              destination_chat_id: dest.chatId,
              payload: {
                spotLtp: stock.spotLtp,
                todayVolM: stock.todayVolM,
                time: event.time,
              },
            });
          }
        } catch (err: any) {
          console.warn(`[CentralFeed] Alert dispatch error for ${dest.chatId}:`, err.message);
        }
      } else {
        // Standalone dispatch
        await sendTelegramMessage(dest.botToken, dest.chatId, alertMessage);
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

    // 1. If memory cache is fresh, return immediately
    if (isFresh) {
      const quotesMap: Record<string, LiveQuoteRecord> = {};
      const targetTickers = tickers && tickers.length > 0 ? tickers : Array.from(this.snapshots.keys());

      targetTickers.forEach((ticker) => {
        const snap = this.snapshots.get(ticker);
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
        }
      });

      if (Object.keys(quotesMap).length > 0) {
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

    // 3. Run single centralized tick
    this.inFlightPromise = (async () => {
      try {
        const result = await this.ingestMarketTick('API_REQUEST');
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
