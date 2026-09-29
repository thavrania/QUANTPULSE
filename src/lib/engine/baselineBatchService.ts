// =====================================================================
// QUANTPULSE — Automated 20-Day Baseline Calculation Service
// Computes true 20-session volume moving average from Dhan Historical Candles
// =====================================================================

import { DHAN_BASE_URL, getDhanSecurityId } from '@/lib/broker/dhan/dhanConstants';

export interface BaselineCalculationOutput {
  ticker: string;
  securityId: string;
  avgVolume20DM: number;
  totalVolumeSumM: number;
  sessionsEvaluated: number;
  volatilityStdDevM: number;
  shortTerm5DAvgM: number;
  trendRatio: number; // 5D Avg / 20D Avg
  calculatedAt: string;
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
  const avgVol = sumVol / last20.length;
  const avgVolume20DM = +(avgVol / 1_000_000).toFixed(3);

  // Short term 5D moving average
  const last5 = last20.slice(-5);
  const sum5D = last5.reduce((acc, v) => acc + (v || 0), 0);
  const shortTerm5DAvgM = +(sum5D / last5.length / 1_000_000).toFixed(3);

  // Volume Volatility (Standard Deviation of Daily Volume)
  const variance =
    last20.reduce((acc, v) => acc + Math.pow(v / 1_000_000 - avgVolume20DM, 2), 0) /
    last20.length;
  const volatilityStdDevM = +Math.sqrt(variance).toFixed(3);

  const trendRatio = +(shortTerm5DAvgM / Math.max(avgVolume20DM, 0.001)).toFixed(2);

  return {
    ticker,
    securityId,
    avgVolume20DM,
    totalVolumeSumM: +(sumVol / 1_000_000).toFixed(2),
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
    } catch (err) {
      console.error(`Failed to calculate baseline for ${ticker}:`, err);
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
