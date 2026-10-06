// =====================================================================
// QUANTPULSE — Automated 20-Day Baseline Calculation Service
// Computes true 20-session volume moving average from Dhan Historical Candles
// =====================================================================

import { DHAN_BASE_URL, getDhanSecurityId } from '@/lib/broker/dhan/dhanConstants';
import { getISTDate } from '@/lib/services/marketHoursService';
import { normalizeTicker } from '@/lib/stocks/stockMaster';

export interface BaselineCalculationOutput {
  ticker: string;
  securityId: string;
  avgVolume20DM: number;
  avg20DTradedShares: number; // Exact count of 20-day average traded shares with zero round-off
  totalVolumeSumM: number;
  totalVolumeSumShares: number; // Exact sum of physical traded shares across evaluated sessions
  sessionsEvaluated: number;
  volatilityStdDevM: number;
  shortTerm5DAvgM: number;
  trendRatio: number; // 5D Avg / 20D Avg
  calculatedAt: string;
}

/**
 * Calculates true 20-Day Traded Shares baseline directly from Yahoo Finance historical daily candles (free fallback).
 * Filters down to completed daily trading sessions (excluding today's live/incomplete session).
 * Automatically resolves corporate rebranding & aliases (e.g. TATAMOTORS -> TMCV, ZOMATO -> ETERNAL, LTIM -> LTM).
 */
export async function calculateFree20DBaseline(
  ticker: string
): Promise<BaselineCalculationOutput | null> {
  const clean = normalizeTicker(ticker);
  const candidateSymbols = clean !== ticker ? [clean, ticker] : [clean];

  for (const sym of candidateSymbols) {
    try {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${sym}.NS?interval=1d&range=2mo`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          cache: 'no-store',
        }
      );

      if (!response.ok) continue;

      const json = await response.json();
      const chart = json?.chart?.result?.[0];
      const timestamps: number[] = chart?.timestamp || [];
      const vols: number[] = chart?.indicators?.quote?.[0]?.volume || [];
      if (!timestamps.length || !vols.length) continue;

      const todayDateStr = getISTDate().dateStr;
      const completedVolumes: number[] = [];

      // Filter to completed daily trading sessions with positive traded volume
      for (let i = 0; i < timestamps.length; i++) {
        const vol = vols[i] || 0;
        if (vol <= 0) continue;
        const barDate = getISTDate(new Date(timestamps[i] * 1000)).dateStr;
        // Do not include today's in-progress session in the completed 20-session historical baseline
        if (barDate === todayDateStr) continue;
        completedVolumes.push(vol);
      }

      if (completedVolumes.length < 5) continue;

      const last20 = completedVolumes.slice(-20);
      const sumVol = last20.reduce((acc, v) => acc + v, 0);
      const avgVolExact = Math.round(sumVol / last20.length);
      const avgVolume20DM = +(avgVolExact / 1_000_000).toFixed(6);

      const last5 = last20.slice(-5);
      const sum5D = last5.reduce((acc, v) => acc + v, 0);
      const shortTerm5DAvgM = +(sum5D / last5.length / 1_000_000);

      const variance =
        last20.reduce((acc, v) => acc + Math.pow(v / 1_000_000 - avgVolume20DM, 2), 0) /
        last20.length;
      const volatilityStdDevM = +Math.sqrt(variance).toFixed(3);
      const trendRatio = +(shortTerm5DAvgM / Math.max(avgVolume20DM, 0.000001)).toFixed(2);

      return {
        ticker,
        securityId: getDhanSecurityId(clean),
        avgVolume20DM,
        avg20DTradedShares: avgVolExact,
        totalVolumeSumM: +(sumVol / 1_000_000).toFixed(4),
        totalVolumeSumShares: sumVol,
        sessionsEvaluated: last20.length,
        volatilityStdDevM,
        shortTerm5DAvgM,
        trendRatio,
        calculatedAt: new Date().toISOString(),
      };
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Calculates the exact 20-Day volume baseline for a single ticker via Dhan HQ API.
 */
export async function calculateSingle20DBaseline(
  ticker: string,
  clientId: string,
  accessToken: string
): Promise<BaselineCalculationOutput | null> {
  const securityId = getDhanSecurityId(ticker);

  const today = new Date();
  const toDateStr = today.toISOString().split('T')[0];
  const fromDate = new Date();
  fromDate.setDate(today.getDate() - 45); // 45 calendar days guarantees >= 20 trading sessions
  const fromDateStr = fromDate.toISOString().split('T')[0];

  const payload = {
    securityId,
    exchangeSegment: 'NSE_EQ',
    instrument: 'EQUITY',
    fromDate: fromDateStr,
    toDate: toDateStr,
  };

  const response = await fetch(`${DHAN_BASE_URL}/charts/historical`, {
    method: 'POST',
    headers: {
      'access-token': accessToken,
      'client-id': clientId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Dhan API error (${response.status}) fetching historical charts for ${ticker}`);
  }

  const chartData = await response.json();
  const rawVolumes: number[] = chartData?.volume || [];

  if (rawVolumes.length < 5) {
    return null;
  }

  // Extract exactly the last 20 completed daily sessions
  const last20 = rawVolumes.slice(-20);
  const sumVol = last20.reduce((acc, v) => acc + (v || 0), 0);
  const avgVolExact = Math.round(sumVol / last20.length);
  const avgVolume20DM = avgVolExact / 1_000_000;

  // Short term 5D moving average
  const last5 = last20.slice(-5);
  const sum5D = last5.reduce((acc, v) => acc + (v || 0), 0);
  const shortTerm5DAvgM = +(sum5D / last5.length / 1_000_000);

  // Volume Volatility (Standard Deviation of Daily Volume)
  const variance =
    last20.reduce((acc, v) => acc + Math.pow(v / 1_000_000 - avgVolume20DM, 2), 0) /
    last20.length;
  const volatilityStdDevM = +Math.sqrt(variance).toFixed(3);

  const trendRatio = +(shortTerm5DAvgM / Math.max(avgVolume20DM, 0.000001)).toFixed(2);

  return {
    ticker,
    securityId,
    avgVolume20DM,
    avg20DTradedShares: avgVolExact,
    totalVolumeSumM: +(sumVol / 1_000_000).toFixed(4),
    totalVolumeSumShares: sumVol,
    sessionsEvaluated: last20.length,
    volatilityStdDevM,
    shortTerm5DAvgM,
    trendRatio,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Throttled batch processor to sync the entire watchlist universe without exceeding API rate limits.
 */
export async function batchSyncWatchlistBaselines(
  tickers: string[],
  clientId: string,
  accessToken: string,
  onProgress?: (completed: number, total: number, lastTicker: string) => void
): Promise<BaselineCalculationOutput[]> {
  const results: BaselineCalculationOutput[] = [];

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    try {
      const output = await calculateSingle20DBaseline(ticker, clientId, accessToken);
      if (output) {
        results.push(output);
      }
    } catch (err: any) {
      console.error(`Failed to calculate baseline for ${ticker}:`, err);
      const errMsg = String(err?.message || '');
      if (
        errMsg.includes('401') ||
        errMsg.includes('403') ||
        errMsg.includes('806') ||
        errMsg.includes('token') ||
        errMsg.includes('unauthorized') ||
        errMsg.includes('Unauthorized')
      ) {
        console.warn('Dhan access token expired or unauthorized. Aborting Dhan historical batch early to engage fallback.');
        break;
      }
    }

    if (onProgress) {
      onProgress(i + 1, tickers.length, ticker);
    }

    // 100ms throttle between Dhan API calls to respect rate limits
    if (i < tickers.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}
