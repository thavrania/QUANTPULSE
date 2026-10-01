import { NextRequest, NextResponse } from 'next/server';
import { DHAN_BASE_URL, getDhanSecurityId } from '@/lib/broker/dhan/dhanConstants';
import { getActiveBrokerCredentials } from '@/lib/services/brokerVaultService';
import { fetchFreeLiveQuotes } from '@/lib/market/freeLiveMarketService';
import { hasTodayMarketSessionStarted, getISTDate } from '@/lib/services/marketHoursService';

export interface LiveQuoteRecord {
  ltp: number;
  volumeM: number;
  volume?: number; // Exact count of physical traded shares today
  high: number;
  low: number;
  open: number;
  close: number;
  changePct: number;
  averagePrice?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tickers, clientId, accessToken } = body;

    let cid = clientId;
    let token = accessToken;

    if (!cid || !token) {
      const vault = await getActiveBrokerCredentials();
      cid = cid || vault.clientId;
      token = token || vault.accessToken;
    }

    const tickerList: string[] =
      Array.isArray(tickers) && tickers.length > 0
        ? tickers
        : ['RELIANCE', 'TMCV', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'ETERNAL'];

    // 1. If no Dhan credentials provided, serve from 100% Free Live NSE Feed
    if (!cid || !token) {
      const freeQuotes = await fetchFreeLiveQuotes(tickerList);
      return NextResponse.json({
        success: true,
        isConfigured: false,
        count: Object.keys(freeQuotes).length,
        quotes: freeQuotes,
        source: 'FREE_NSE_LIVE',
        notice: '100% Free Live NSE Feed Active ($0/month subscription).',
        timestamp: new Date().toISOString(),
      });
    }

    const securityIds = tickerList.map((t) => parseInt(getDhanSecurityId(t), 10));

    // 2. Try Dhan Marketfeed API
    try {
      const response = await fetch(`${DHAN_BASE_URL}/marketfeed/quote`, {
        method: 'POST',
        headers: {
          'access-token': token,
          'client-id': cid,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          NSE_EQ: securityIds,
        }),
        cache: 'no-store',
      });

      // If Dhan rejects with 401 (e.g. 806 Data API not subscribed) or 429:
      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[QuoteRoute] Dhan error (${response.status}): ${errText}. Falling back to 100% Free Live Feed.`);

        const freeQuotes = await fetchFreeLiveQuotes(tickerList);
        return NextResponse.json({
          success: true,
          isConfigured: true,
          count: Object.keys(freeQuotes).length,
          quotes: freeQuotes,
          source: 'FREE_NSE_LIVE',
          notice: 'Active on 100% Free Live NSE Feed (Dhan Data API add-on not subscribed).',
          timestamp: new Date().toISOString(),
        });
      }

      const quoteData = await response.json();
      const nseData = quoteData?.data?.NSE_EQ || {};

      const quotes: Record<string, LiveQuoteRecord> = {};
      const sessionStarted = hasTodayMarketSessionStarted();

      tickerList.forEach((sym) => {
        const secId = getDhanSecurityId(sym);
        const item = nseData[secId];
        if (item) {
          const ltp = item.last_price || item.close || 0;
          const close = item.close || ltp;
          const calcChange = close > 0 ? +(((ltp - close) / close) * 100).toFixed(2) : 0;

          // Sanitize volume: Verify that trades are genuinely from today's regular session (>= 09:15 IST)
          let isTradeFromToday = true;
          if (item.last_trade_time) {
            const tVal = item.last_trade_time;
            const epochMs = typeof tVal === 'number'
              ? (tVal < 1e11 ? tVal * 1000 : tVal)
              : Date.parse(String(tVal));
            if (!isNaN(epochMs)) {
              const tradeDate = getISTDate(new Date(epochMs));
              const todayDate = getISTDate();
              isTradeFromToday = tradeDate.dateStr === todayDate.dateStr && (tradeDate.hours * 60 + tradeDate.minutes >= 9 * 60 + 15);
            }
          }

          const istNow = getISTDate();
          const secsSinceOpen = (istNow.hours * 3600 + istNow.minutes * 60 + istNow.seconds) - (9 * 3600 + 15 * 60);

          let rawVol = (sessionStarted && isTradeFromToday) ? (item.volume || 0) : 0;
          // In the first 60 seconds of open (09:15:00 - 09:16:00), broker cache can retain yesterday's volume if trade is unconfirmed
          if (secsSinceOpen >= 0 && secsSinceOpen < 60 && rawVol > 500_000 && !isTradeFromToday) {
            rawVol = 0;
          }

          const effectiveVolume = rawVol;

          quotes[sym] = {
            ltp: +(ltp).toFixed(2),
            volumeM: effectiveVolume / 1_000_000,
            volume: effectiveVolume,
            high: +(item.high || ltp).toFixed(2),
            low: +(item.low || ltp).toFixed(2),
            open: +(item.open || ltp).toFixed(2),
            close: +(close).toFixed(2),
            changePct: item.change_percent !== undefined ? +item.change_percent.toFixed(2) : calcChange,
            averagePrice: item.average_price ? +(item.average_price).toFixed(2) : undefined,
          };
        }
      });

      // If Dhan returned empty map, fall back to free feed
      if (Object.keys(quotes).length === 0) {
        const freeQuotes = await fetchFreeLiveQuotes(tickerList);
        return NextResponse.json({
          success: true,
          isConfigured: true,
          count: Object.keys(freeQuotes).length,
          quotes: freeQuotes,
          source: 'FREE_NSE_LIVE',
          timestamp: new Date().toISOString(),
        });
      }

      return NextResponse.json({
        success: true,
        isConfigured: true,
        count: Object.keys(quotes).length,
        quotes,
        source: 'DHAN_HQ',
        timestamp: new Date().toISOString(),
      });
    } catch (dhanErr: any) {
      console.warn('[QuoteRoute] Dhan network exception. Falling back to free feed:', dhanErr.message);
      const freeQuotes = await fetchFreeLiveQuotes(tickerList);
      return NextResponse.json({
        success: true,
        isConfigured: true,
        count: Object.keys(freeQuotes).length,
        quotes: freeQuotes,
        source: 'FREE_NSE_LIVE',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Failed to fetch live quotes: ${err.message}` },
      { status: 500 }
    );
  }
}
