import { Stock, CrossoverEvent, VolumeMetrics, VolumeStatusCode } from '../types/quant';

export const INITIAL_WATCHLIST_DATA: Stock[] = [
  {
    ticker: 'RELIANCE',
    shortName: 'Reliance',
    name: 'Reliance Industries Limited',
    isFnO: true,
    segment: 'NSE_FNO',
    sector: 'Oil & Gas / Conglomerate',
    securityId: '1330',
    isin: 'INE002A01018',
    lotSize: 250,
    strikeStep: 50,
    spotLtp: 2968.50,
    todayVolM: 0.0,
    avgVol20DM: 5.20,
    hasCrossed20D: false,
    crossoverTime: null,
    crossoverSpotPrice: null,
    ivPct: 18.4,
    justCrossedHighlight: false,
    dayHigh: 2985.00,
    dayLow: 2942.10,
    dayOpen: 2950.00,
    dayClose: 2962.00,
    changePct: 0.22,
    feedSource: 'LIVE_DHAN',
  },
  {
    ticker: 'TCS',
    shortName: 'TCS',
    name: 'Tata Consultancy Services Limited',
    isFnO: true,
    segment: 'NSE_FNO',
    sector: 'Information Technology',
    securityId: '11536',
    isin: 'INE467B01029',
    lotSize: 175,
    strikeStep: 50,
    spotLtp: 4126.00,
    todayVolM: 0.0,
    avgVol20DM: 1.50,
    hasCrossed20D: false,
    crossoverTime: null,
    crossoverSpotPrice: null,
    ivPct: 16.2,
    justCrossedHighlight: false,
    dayHigh: 4160.00,
    dayLow: 4110.00,
    dayOpen: 4140.00,
    dayClose: 4135.00,
    changePct: -0.22,
    feedSource: 'LIVE_DHAN',
  },
  {
    ticker: 'HDFCBANK',
    shortName: 'HDFC Bank',
    name: 'HDFC Bank Limited',
    isFnO: true,
    segment: 'NSE_FNO',
    sector: 'Private Banking & Financials',
    securityId: '1333',
    isin: 'INE040A01034',
    lotSize: 550,
    strikeStep: 20,
    spotLtp: 1644.20,
    todayVolM: 0.0,
    avgVol20DM: 6.00,
    hasCrossed20D: false,
    crossoverTime: null,
    crossoverSpotPrice: null,
    ivPct: 14.9,
    justCrossedHighlight: false,
    dayHigh: 1658.00,
    dayLow: 1636.50,
    dayOpen: 1640.00,
    dayClose: 1638.00,
    changePct: 0.38,
    feedSource: 'LIVE_DHAN',
  },
  {
    ticker: 'ICICIBANK',
    shortName: 'ICICI Bank',
    name: 'ICICI Bank Limited',
    isFnO: true,
    segment: 'NSE_FNO',
    sector: 'Private Banking & Financials',
    securityId: '4963',
    isin: 'INE090A01021',
    lotSize: 700,
    strikeStep: 20,
    spotLtp: 1258.00,
    todayVolM: 0.0,
    avgVol20DM: 7.00,
    hasCrossed20D: false,
    crossoverTime: null,
    crossoverSpotPrice: null,
    ivPct: 15.6,
    justCrossedHighlight: false,
    dayHigh: 1269.00,
    dayLow: 1248.00,
    dayOpen: 1252.00,
    dayClose: 1250.00,
    changePct: 0.64,
    feedSource: 'LIVE_DHAN',
  },
];

export const INITIAL_CROSSOVER_LOGS: CrossoverEvent[] = [];

export function formatClockIST(totalSeconds: number): string {
  const secsInDay = ((Math.floor(totalSeconds) % 86400) + 86400) % 86400;
  const hrs = String(Math.floor(secsInDay / 3600)).padStart(2, '0');
  const mins = String(Math.floor((secsInDay % 3600) / 60)).padStart(2, '0');
  const secs = String(secsInDay % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

export function getVolumeScreenerMetrics(stock: Stock): VolumeMetrics {
  const progressPct = +((stock.todayVolM / Math.max(stock.avgVol20DM, 0.001)) * 100).toFixed(1);
  const rvolRatio = +(stock.todayVolM / Math.max(stock.avgVol20DM, 0.001)).toFixed(2);
  const deficitM = Math.max(0, +(stock.avgVol20DM - stock.todayVolM).toFixed(3));
  const deficitShares = Math.max(0, Math.round((stock.avgVol20DM - stock.todayVolM) * 1_000_000));
  const surplusShares = Math.max(0, Math.round((stock.todayVolM - stock.avgVol20DM) * 1_000_000));

  // Rule 5: Strict Day Start Integrity - traded shares must genuinely meet/exceed 20D average (> 0)
  const hasVolumeCrossed =
    (stock.hasCrossed20D || stock.todayVolM >= stock.avgVol20DM) &&
    stock.todayVolM >= stock.avgVol20DM &&
    stock.todayVolM > 0;

  // Rule 1: Bullish Price / Candle Filter (Spot LTP >= Day Open or changePct >= 0)
  const isBullish = stock.spotLtp >= (stock.dayOpen || stock.spotLtp) || (stock.changePct ?? 0) >= 0;

  // Fully Eligible: Traded Shares Crossover + Bullish Price Action
  const isEligibleForBuy = hasVolumeCrossed && isBullish;

  let statusCode: VolumeStatusCode = 'TRACKING_VOLUME';
  let statusBadge = 'TRACKING SHARES (< 20D)';

  if (hasVolumeCrossed) {
    if (isBullish) {
      statusCode = 'ELIGIBLE_FOR_BUY';
      statusBadge = 'ELIGIBLE FOR BUY';
    } else {
      statusCode = 'HIGH_VOL_BEARISH';
      statusBadge = 'SHARES CROSSED (BEARISH)';
    }
  }

  return {
    progressPct,
    rvolRatio,
    deficitM,
    deficitShares,
    surplusShares,
    isEligibleForBuy,
    statusCode,
    statusBadge,
  };
}

export function checkAndLatchVolumeCrossover(
  stock: Stock,
  currentTimeStr: string
): { newlyCrossed: boolean; event: CrossoverEvent | null } {
  // Volume condition: Today volume must meet or exceed 20D average (> 0)
  const volumeCrossed = stock.todayVolM >= stock.avgVol20DM && stock.todayVolM > 0;

  // Rule 5: If volume has not crossed (e.g. Day Start or 0.0M before session start), clear any stale crossover latch
  if (stock.todayVolM < stock.avgVol20DM || stock.todayVolM === 0) {
    stock.hasCrossed20D = false;
    stock.crossoverTime = null;
    stock.crossoverSpotPrice = null;
    stock.justCrossedHighlight = false;
    return { newlyCrossed: false, event: null };
  }

  // Idempotency: Once a stock has already triggered/latched crossover, NEVER generate a duplicate event!
  if (stock.hasCrossed20D || Boolean(stock.crossoverTime)) {
    // Preserve latched status as volume is still >= 20D average
    stock.hasCrossed20D = true;
    return { newlyCrossed: false, event: null };
  }

  // Rule 1: Price must be bullish at crossover trigger moment (LTP >= Day Open or changePct >= 0)
  const isBullish = stock.spotLtp >= (stock.dayOpen || stock.spotLtp) || (stock.changePct ?? 0) >= 0;

  if (volumeCrossed && isBullish) {
    stock.hasCrossed20D = true;
    stock.crossoverTime = currentTimeStr;
    stock.crossoverSpotPrice = stock.spotLtp;
    stock.justCrossedHighlight = true;

    const event: CrossoverEvent = {
      ticker: stock.ticker,
      time: currentTimeStr,
      avgVol20DM: stock.avgVol20DM,
      crossPrice: stock.spotLtp,
      isFnO: stock.isFnO,
    };

    return { newlyCrossed: true, event };
  }

  return { newlyCrossed: false, event: null };
}
