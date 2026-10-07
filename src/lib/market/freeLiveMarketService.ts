import { LiveQuoteRecord } from '../types/quant';
import { getISTDate, hasTodayMarketSessionStarted } from '../services/marketHoursService';

/**
 * 100% Free Live Market Data Service for Indian Equities (NSE)
 * Queries high-speed real-time exchange data without requiring any API keys or paid subscriptions.
 */

export async function fetchFreeLiveQuotes(
  tickers: string[]
): Promise<Record<string, LiveQuoteRecord>> {
  const quotes: Record<string, LiveQuoteRecord> = {};

  const cleanTickers = Array.from(new Set(tickers.map((t) => t.trim().toUpperCase())));

  // Helper to fetch single ticker with alias fallback
  const fetchSingleTicker = async (ticker: string): Promise<{ ticker: string; record: LiveQuoteRecord } | null> => {
    // Generate candidate symbols for Yahoo (e.g., TMCV -> TATAMOTORS.NS fallback, ETERNAL -> ZOMATO.NS fallback)
    const candidates: string[] = [];
    if (ticker === 'TMCV') candidates.push('TATAMOTORS.NS', 'TMCV.NS');
    else if (ticker === 'ETERNAL') candidates.push('ZOMATO.NS', 'ETERNAL.NS');
    else if (ticker === 'LTM') candidates.push('LTIM.NS', 'LTM.NS');
    else {
      candidates.push(ticker.includes('.') ? ticker : `${ticker}.NS`);
    }

    for (const yahooSymbol of candidates) {
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

        if (!res.ok) continue;

        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        const quoteIndicator = json?.chart?.result?.[0]?.indicators?.quote?.[0];

        if (!meta) continue;

        const ltp = Number(meta.regularMarketPrice) || 0;
        const prevClose = Number(meta.chartPreviousClose) || ltp;

        const ist = getISTDate();
        const todayDateStr = ist.dateStr;
        const sessionStarted = hasTodayMarketSessionStarted();

        // Check whether Yahoo's quote timestamp corresponds to today's date in IST and after 09:15
        let isQuoteFromToday = false;
        if (meta.regularMarketTime) {
          const quoteDate = new Date(meta.regularMarketTime * 1000);
          const quoteIst = getISTDate(quoteDate);
          isQuoteFromToday =
            quoteIst.dateStr === todayDateStr &&
            quoteIst.hours * 60 + quoteIst.minutes >= 9 * 60 + 15;
        }

        const isYahooDelayedWindow = ist.hours === 9 && ist.minutes >= 15 && ist.minutes < 30;
        const isTodayVolumeValid = sessionStarted && isQuoteFromToday && !isYahooDelayedWindow;
        const rawVol = isTodayVolumeValid
          ? Number(meta.regularMarketVolume) ||
            (Array.isArray(quoteIndicator?.volume) && quoteIndicator.volume[0]) ||
            0
          : 0;

        const volumeM = rawVol / 1_000_000;
        const dayHigh = isTodayVolumeValid ? Number(meta.regularMarketDayHigh) || ltp : ltp;
        const dayLow = isTodayVolumeValid ? Number(meta.regularMarketDayLow) || ltp : ltp;
        const dayOpen = isTodayVolumeValid
          ? (Array.isArray(quoteIndicator?.open) && Number(quoteIndicator.open[0])) || ltp
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
          volume: rawVol,
          high: +dayHigh.toFixed(2),
          low: +dayLow.toFixed(2),
          open: +dayOpen.toFixed(2),
          close: +prevClose.toFixed(2),
          changePct,
          averagePrice: +((dayHigh + dayLow + ltp) / 3).toFixed(2),
        };

        return { ticker, record };
      } catch (err: any) {
        // try next candidate
      }
    }

    return null;
  };

  // Fetch in parallel chunks of 10 to ensure rapid execution without rate limiting
  const CHUNK_SIZE = 10;
  for (let i = 0; i < cleanTickers.length; i += CHUNK_SIZE) {
    const chunk = cleanTickers.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.allSettled(chunk.map((ticker) => fetchSingleTicker(ticker)));
    chunkResults.forEach((r) => {
      if (r.status === 'fulfilled' && r.value) {
        quotes[r.value.ticker] = r.value.record;
      }
    });
  }

  return quotes;
}
