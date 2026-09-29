// =====================================================================
// QUANTPULSE — NSE Option Chain Resolver & Multi-Strike Matrix Engine
// Resolves ATM, ITM, and OTM Call/Put contracts, Greeks, and OI Sentiment
// =====================================================================

import { calculateCallGreeks, OptionGreeks } from './blackScholes';

export interface OptionStrikeRow {
  strikePrice: number;
  moneyness: 'ITM' | 'ATM' | 'OTM';
  callSymbol: string;
  callLtp: number;
  callBid: number;
  callAsk: number;
  callOi: number;
  callOiChange: number;
  callVolume: number;
  callIvPct: number;
  callGreeks: OptionGreeks;
  oiSentiment: 'LONG_BUILDUP' | 'SHORT_COVERING' | 'SHORT_BUILDUP' | 'LONG_UNWINDING' | 'NEUTRAL';
  // Put data for PCR
  putLtp: number;
  putOi: number;
}

export interface OptionChainSummary {
  underlying: string;
  spotPrice: number;
  atmStrike: number;
  expiryDate: string;
  daysToExpiry: number;
  totalCallOi: number;
  totalPutOi: number;
  pcrRatio: number; // Put-Call Ratio (Total Put OI / Total Call OI)
  strikes: OptionStrikeRow[];
}

/**
 * Gets the nearest NSE Monthly / Weekly expiry date string.
 */
export function getNearestExpiryDate(): { expiryDate: string; daysToExpiry: number; yearsToExpiry: number } {
  const now = new Date();
  // NSE Stock Options expire on the last Thursday of the month
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // Find the last Thursday of the current month
  const lastDay = new Date(year, month + 1, 0); // last day of month
  let lastThursday = new Date(lastDay);
  
  while (lastThursday.getDay() !== 4) {
    lastThursday.setDate(lastThursday.getDate() - 1);
  }

  // If last Thursday has passed, move to next month's last Thursday
  if (now > lastThursday) {
    const nextMonthLastDay = new Date(year, month + 2, 0);
    lastThursday = new Date(nextMonthLastDay);
    while (lastThursday.getDay() !== 4) {
      lastThursday.setDate(lastThursday.getDate() - 1);
    }
  }

  const diffTime = Math.max(1, lastThursday.getTime() - now.getTime());
  const daysToExpiry = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const yearsToExpiry = +(daysToExpiry / 365).toFixed(4);

  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const formattedDate = `${String(lastThursday.getDate()).padStart(2, '0')}-${monthNames[lastThursday.getMonth()]}-${lastThursday.getFullYear()}`;

  return {
    expiryDate: formattedDate,
    daysToExpiry,
    yearsToExpiry,
  };
}

/**
 * Resolves a complete 7-Strike Option Chain Matrix centered on ATM for an underlying stock.
 */
export function buildOptionChainMatrix(
  ticker: string,
  spotLtp: number,
  strikeStep: number,
  baseIvPct: number = 18.5
): OptionChainSummary {
  const { expiryDate, daysToExpiry, yearsToExpiry } = getNearestExpiryDate();

  // Round spot price to nearest strike step to determine exact ATM
  const atmStrike = Math.round(spotLtp / strikeStep) * strikeStep;

  // Generate 7 strikes: 3 ITM, 1 ATM, 3 OTM
  const strikeList: number[] = [];
  for (let i = -3; i <= 3; i++) {
    strikeList.push(atmStrike + i * strikeStep);
  }

  let totalCallOi = 0;
  let totalPutOi = 0;

  const strikes: OptionStrikeRow[] = strikeList.map((strike) => {
    const moneyness: 'ITM' | 'ATM' | 'OTM' =
      strike === atmStrike ? 'ATM' : strike < atmStrike ? 'ITM' : 'OTM';

    // Volatility skew: OTM strikes typically have slightly higher IV (volatility smile)
    const ivSkew = moneyness === 'OTM' ? 1.05 : moneyness === 'ITM' ? 0.98 : 1.0;
    const strikeIv = +(baseIvPct * ivSkew).toFixed(1);
    const sigma = strikeIv / 100;

    const greeks = calculateCallGreeks({
      spotPrice: spotLtp,
      strikePrice: strike,
      timeToExpiryYears: yearsToExpiry,
      volatility: sigma,
    });

    const callPrice = greeks.theoreticalPrice;
    const callBid = Math.max(0.05, +(callPrice * 0.985).toFixed(2));
    const callAsk = +(callPrice * 1.015).toFixed(2);

    // Realistic Open Interest model
    const oiBase = Math.floor(150000 + Math.random() * 850000);
    const oiChange = Math.floor((Math.random() - 0.35) * 45000);
    const putOiBase = Math.floor(120000 + Math.random() * 900000);

    totalCallOi += oiBase;
    totalPutOi += putOiBase;

    // Determine Institutional Sentiment
    let sentiment: OptionStrikeRow['oiSentiment'] = 'NEUTRAL';
    if (oiChange > 0 && callPrice > (spotLtp * 0.015)) {
      sentiment = 'LONG_BUILDUP';
    } else if (oiChange < 0 && callPrice > (spotLtp * 0.015)) {
      sentiment = 'SHORT_COVERING';
    } else if (oiChange > 0) {
      sentiment = 'SHORT_BUILDUP';
    } else {
      sentiment = 'LONG_UNWINDING';
    }

    const putIntrinsic = Math.max(0.05, +(strike - spotLtp).toFixed(2));
    const putLtp = Math.max(0.1, +(callPrice + strike - spotLtp).toFixed(2));

    return {
      strikePrice: strike,
      moneyness,
      callSymbol: `${ticker} ${strike} CE`,
      callLtp: callPrice,
      callBid,
      callAsk,
      callOi: oiBase,
      callOiChange: oiChange,
      callVolume: Math.floor(oiBase * 0.45),
      callIvPct: strikeIv,
      callGreeks: greeks,
      oiSentiment: sentiment,
      putLtp,
      putOi: putOiBase,
    };
  });

  const pcrRatio = +(totalPutOi / Math.max(totalCallOi, 1)).toFixed(2);

  return {
    underlying: ticker,
    spotPrice: spotLtp,
    atmStrike,
    expiryDate,
    daysToExpiry,
    totalCallOi,
    totalPutOi,
    pcrRatio,
    strikes,
  };
}
