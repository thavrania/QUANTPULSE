import { LiveQuoteRecord } from '@/app/api/broker/dhan/quote/route';
import { getISTDate, hasTodayMarketSessionStarted } from '@/lib/services/marketHoursService';

/**
 * 100% Free Live Market Data Service for Indian Equities (NSE)
 * Queries high-speed real-time exchange data without requiring any API keys or paid subscriptions.
 */

export async function fetchFreeLiveQuotes(
  tickers: string[]
): Promise<Record<string, LiveQuoteRecord>> {
  const quotes: Record<string, LiveQuoteRecord> = {};

  const cleanTickers = tickers.map((t) => t.trim().toUpperCase());

  // Fetch all tickers concurrently
  const fetchPromises = cleanTickers.map(async (ticker) => {
    const yahooSymbol = ticker.includes('.') ? ticker : `${ticker}.NS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooSymbol
    )}?interval=1d&range=1d`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        console.warn(`[FreeLiveFeed] Non-200 for ${ticker}: ${res.status}`);
        return null;
      }

      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      const quoteIndicator = json?.chart?.result?.[0]?.indicators?.quote?.[0];

      if (!meta) return null;

      const ltp = Number(meta.regularMarketPrice) || 0;
      const prevClose = Number(meta.chartPreviousClose) || ltp;

      const ist = getISTDate();
      const todayDateStr = ist.dateStr;
      const sessionStarted = hasTodayMarketSessionStarted();

      // Check whether Yahoo's quote timestamp corresponds to today's date in IST
      let isQuoteFromToday = false;
      if (meta.regularMarketTime) {
        const quoteDate = new Date(meta.regularMarketTime * 1000);
        isQuoteFromToday = getISTDate(quoteDate).dateStr === todayDateStr;
      }

      // Today's traded volume is only valid if regular trading has opened today (>= 09:15 IST)
      // AND the quote timestamp is genuinely from today's session.
      // Outside market hours or before 09:15 IST, volume for today is strictly 0.00M.
      const isTodayVolumeValid = sessionStarted && isQuoteFromToday;
      const rawVol = isTodayVolumeValid
        ? (Number(meta.regularMarketVolume) ||
           (Array.isArray(quoteIndicator?.volume) && quoteIndicator.volume[0]) ||
           0)
        : 0;

      const volumeM = +(rawVol / 1_000_000).toFixed(3);
      const dayHigh = isTodayVolumeValid ? (Number(meta.regularMarketDayHigh) || ltp) : ltp;
      const dayLow = isTodayVolumeValid ? (Number(meta.regularMarketDayLow) || ltp) : ltp;
      const dayOpen = isTodayVolumeValid
        ? ((Array.isArray(quoteIndicator?.open) && Number(quoteIndicator.open[0])) || ltp)
        : ltp;

      const changePct =
        meta.regularMarketChangePercent !== undefined
          ? +Number(meta.regularMarketChangePercent).toFixed(2)
          : prevClose > 0
          ? +(((ltp - prevClose) / prevClose) * 100).toFixed(2)
          : 0;

      const record: LiveQuoteRecord = {
        ltp: +ltp.toFixed(2),
        volumeM,
        high: +dayHigh.toFixed(2),
        low: +dayLow.toFixed(2),
        open: +dayOpen.toFixed(2),
        close: +prevClose.toFixed(2),
        changePct,
        averagePrice: +((dayHigh + dayLow + ltp) / 3).toFixed(2),
      };

      return { ticker, record };
    } catch (err: any) {
      console.warn(`[FreeLiveFeed] Failed fetching ${ticker}:`, err.message);
      return null;
    }
  });

  const results = await Promise.allSettled(fetchPromises);

  results.forEach((r) => {
    if (r.status === 'fulfilled' && r.value) {
      quotes[r.value.ticker] = r.value.record;
    }
  });

  return quotes;
}
