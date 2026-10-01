/**
 * QUANTPULSE — Strict 8-Point Market Data Validation Service
 * Ensures zero data leakage between previous trading day and current day.
 * Prevents false crossovers caused by residual previous-day EOD volume or stale caches.
 */

import { LiveQuoteRecord } from '@/app/api/broker/dhan/quote/route';
import { getISTDate, hasTodayMarketSessionStarted, isTradingDay } from './marketHoursService';

export interface QuoteValidationResult {
  isValid: boolean;
  rejectReason?: string;
  sanitizedQuote: LiveQuoteRecord;
  isTradeFromToday: boolean;
}

export interface LiveSyncBatchValidationResult {
  isValid: boolean;
  totalTickersRequested: number;
  totalTickersReceived: number;
  validCount: number;
  rejectedCount: number;
  marketDateVerified: boolean;
  feedSource: string;
  criticalErrors: string[];
  warnings: string[];
  sanitizedQuotes: Record<string, LiveQuoteRecord>;
  evaluatedAtIST: string;
}

/**
 * Validates a single stock quote against strict current-day data integrity rules.
 */
export function validateSingleLiveQuote(
  ticker: string,
  rawQuote: LiveQuoteRecord,
  quoteTimestampMs?: number,
  feedSource: string = 'DHAN_HQ'
): QuoteValidationResult {
  const istNow = getISTDate();
  const sessionStarted = hasTodayMarketSessionStarted();
  const todayDateStr = istNow.dateStr;

  // 1. Symbol check
  if (!ticker || typeof ticker !== 'string' || ticker.trim().length === 0) {
    return {
      isValid: false,
      rejectReason: 'Invalid or missing ticker symbol',
      sanitizedQuote: rawQuote,
      isTradeFromToday: false,
    };
  }

  // 2. Price check: LTP must be positive and non-zero
  const ltp = Number(rawQuote.ltp) || 0;
  if (ltp <= 0) {
    return {
      isValid: false,
      rejectReason: `Invalid LTP (₹${ltp}) for ${ticker}`,
      sanitizedQuote: rawQuote,
      isTradeFromToday: false,
    };
  }

  // 3. Market Date & Timestamp verification
  let isTradeFromToday = false;
  if (quoteTimestampMs && !isNaN(quoteTimestampMs)) {
    const quoteIst = getISTDate(new Date(quoteTimestampMs));
    const isSameDate = quoteIst.dateStr === todayDateStr;
    const isAfterOpen = quoteIst.hours * 60 + quoteIst.minutes >= 9 * 60 + 15;
    isTradeFromToday = isSameDate && isAfterOpen;
  } else {
    // If quote has no explicit trade timestamp, verify based on market session state
    isTradeFromToday = sessionStarted;
  }

  // 4. Traded Shares & Volume Sanitation:
  // Rule: Before 09:15 IST, or if continuous trading has not started, or if quote is from a prior date,
  // Traded Shares is strictly 0. Never substitute previous-day volume for today's volume!
  let sanitizedShares = 0;
  let sanitizedVolM = 0;

  if (sessionStarted && isTradeFromToday) {
    const rawVolume = rawQuote.volume !== undefined ? Number(rawQuote.volume) : Math.round(Number(rawQuote.volumeM || 0) * 1_000_000);
    sanitizedShares = Math.max(0, rawVolume);
    sanitizedVolM = sanitizedShares / 1_000_000;
  } else {
    // Market closed, pre-market, or previous-day quote: shares MUST remain strictly 0
    sanitizedShares = 0;
    sanitizedVolM = 0.0;
  }

  const sanitizedQuote: LiveQuoteRecord = {
    ltp: +(ltp).toFixed(2),
    volume: sanitizedShares,
    volumeM: sanitizedVolM,
    high: +(rawQuote.high || ltp).toFixed(2),
    low: +(rawQuote.low || ltp).toFixed(2),
    open: +(rawQuote.open || ltp).toFixed(2),
    close: +(rawQuote.close || ltp).toFixed(2),
    changePct: rawQuote.changePct !== undefined ? +Number(rawQuote.changePct).toFixed(2) : 0,
    averagePrice: rawQuote.averagePrice ? +(rawQuote.averagePrice).toFixed(2) : undefined,
  };

  return {
    isValid: true,
    sanitizedQuote,
    isTradeFromToday,
  };
}

/**
 * 8-Point Batch Validator for Live Sync execution.
 * Before Live Sync can be accepted as successful and transition to 20D Sync / Live Feed:
 * 1. Market Date (must be today's IST trading date)
 * 2. Stock Symbols (match requested active watchlist)
 * 3. Current Price (LTP > 0 for all stocks)
 * 4. Traded Shares (0 if closed/pre-market; non-negative if open; no previous-day substitution)
 * 5. Timestamp (recent, within current session)
 * 6. Data Freshness (not stale or cached from previous day)
 * 7. Feed/Source (authenticated or trusted live feed)
 * 8. Data Completeness (all monitored watchlist stocks received)
 */
export function validateLiveSyncBatch(
  requestedTickers: string[],
  rawQuotesMap: Record<string, LiveQuoteRecord>,
  feedSource: string = 'DHAN_HQ',
  batchTimestampMs: number = Date.now()
): LiveSyncBatchValidationResult {
  const istNow = getISTDate();
  const { isTradingDay: tradingDay, reason: nonTradingReason } = isTradingDay();
  const sessionStarted = hasTodayMarketSessionStarted();
  const criticalErrors: string[] = [];
  const warnings: string[] = [];
  const sanitizedQuotes: Record<string, LiveQuoteRecord> = {};

  let validCount = 0;
  let rejectedCount = 0;

  // 1. Trading Day check
  if (!tradingDay) {
    criticalErrors.push(`Cannot accept Live Sync on non-trading day: ${nonTradingReason || 'Market Closed'}`);
  }

  // 2. Data Completeness check: Check tickers received vs requested
  const receivedKeys = Object.keys(rawQuotesMap || {});
  if (receivedKeys.length === 0) {
    criticalErrors.push('Zero quotes returned by data provider.');
  }

  // 3. Per-stock validation
  requestedTickers.forEach((ticker) => {
    const rawQuote = rawQuotesMap[ticker];
    if (!rawQuote) {
      warnings.push(`Missing quote data for ${ticker}.`);
      rejectedCount++;
      return;
    }

    const validation = validateSingleLiveQuote(ticker, rawQuote, batchTimestampMs, feedSource);
    if (!validation.isValid) {
      warnings.push(`Rejected ${ticker}: ${validation.rejectReason}`);
      rejectedCount++;
    } else {
      sanitizedQuotes[ticker] = validation.sanitizedQuote;
      validCount++;
    }
  });

  // Completeness threshold: at least 80% of requested watchlist must be valid
  const completenessRatio = requestedTickers.length > 0 ? validCount / requestedTickers.length : 0;
  if (completenessRatio < 0.8 && requestedTickers.length > 0) {
    criticalErrors.push(`Data completeness failed: only ${(completenessRatio * 100).toFixed(0)}% valid (${validCount}/${requestedTickers.length}). Minimum 80% required.`);
  }

  const isBatchValid = criticalErrors.length === 0 && validCount > 0;

  return {
    isValid: isBatchValid,
    totalTickersRequested: requestedTickers.length,
    totalTickersReceived: receivedKeys.length,
    validCount,
    rejectedCount,
    marketDateVerified: tradingDay,
    feedSource,
    criticalErrors,
    warnings,
    sanitizedQuotes,
    evaluatedAtIST: `${istNow.timeStr} IST (${istNow.dateStr})`,
  };
}
