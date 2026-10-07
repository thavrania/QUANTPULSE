import { Stock, CrossoverEvent, VolumeMetrics, VolumeStatusCode } from '../types/quant';
import { hasTodayMarketSessionStarted, getISTDate } from '../services/marketHoursService';
import { STOCK_MASTER_CATALOG, convertMasterToStock } from '../stocks/stockMaster';

export const INITIAL_WATCHLIST_DATA: Stock[] = STOCK_MASTER_CATALOG.map((master) =>
  convertMasterToStock(master)
);

function getStockForSimulation(ticker: string): Stock {
  const found = INITIAL_WATCHLIST_DATA.find((s) => s.ticker === ticker);
  if (found) return { ...found };
  const master = STOCK_MASTER_CATALOG.find((m) => m.ticker === ticker);
  return master
    ? convertMasterToStock(master)
    : {
        ticker,
        name: ticker,
        isFnO: true,
        lotSize: 100,
        strikeStep: 20,
        spotLtp: 1000,
        todayVolM: 0,
        avgVol20DM: 5,
        hasCrossed20D: false,
        crossoverTime: null,
        crossoverSpotPrice: null,
        ivPct: 18.0,
        feedSource: 'SIMULATED',
      };
}

export const INITIAL_SIMULATION_WATCHLIST_DATA: Stock[] = [
  {
    ...getStockForSimulation('RELIANCE'), // avg ~5.2M shares
    todayVolM: 4.88,
    todayTradedShares: 4880000, // 93.8% progress
    feedSource: 'SIMULATED',
  },
  {
    ...getStockForSimulation('TCS'), // avg ~1.5M shares
    todayVolM: 1.25,
    todayTradedShares: 1250000, // 83.3% progress
    feedSource: 'SIMULATED',
  },
  {
    ...getStockForSimulation('HDFCBANK'), // avg ~6.0M shares
    todayVolM: 5.10,
    todayTradedShares: 5100000, // 85.0% progress
    feedSource: 'SIMULATED',
  },
  {
    ...getStockForSimulation('ICICIBANK'), // avg ~7.0M shares
    todayVolM: 6.82,
    todayTradedShares: 6820000, // 97.4% progress -> crosses in 1-2 simulation ticks!
    feedSource: 'SIMULATED',
  },
  {
    ...getStockForSimulation('TMCV'), // avg ~8.9M shares
    todayVolM: 8.45,
    todayTradedShares: 8450000, // 94.9% progress -> crosses in 3-4 simulation ticks!
    feedSource: 'SIMULATED',
  },
  {
    ...getStockForSimulation('ETERNAL'), // avg ~19.0M shares
    todayVolM: 13.50,
    todayTradedShares: 13500000, // 71.0% progress
    feedSource: 'SIMULATED',
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

export function getVolumeScreenerMetrics(stock: Stock, isSimulation?: boolean): VolumeMetrics {
  const isSim = isSimulation ?? (stock.feedSource === 'SIMULATED');
  const todayShares = stock.todayTradedShares !== undefined ? stock.todayTradedShares : Math.round(stock.todayVolM * 1_000_000);
  const avgShares = stock.avg20DTradedShares !== undefined ? stock.avg20DTradedShares : Math.round(stock.avgVol20DM * 1_000_000);

  const progressPct = avgShares > 0 ? +((todayShares / avgShares) * 100).toFixed(1) : 0;
  const rvolRatio = avgShares > 0 ? +(todayShares / avgShares).toFixed(2) : 0;
  const deficitShares = Math.max(0, avgShares - todayShares);
  const surplusShares = Math.max(0, todayShares - avgShares);
  const deficitM = +(deficitShares / 1_000_000).toFixed(3);

  // In live trading, regular market session MUST be active (>= 09:15:00 IST).
  // In simulation / demo mode, session gate is bypassed so demo replay functions reliably at all times.
  const sessionStarted = isSim || hasTodayMarketSessionStarted();
  const hasVolumeCrossed =
    sessionStarted &&
    (stock.hasCrossed20D || todayShares >= avgShares) &&
    todayShares >= avgShares &&
    todayShares > 0;

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
  currentTimeStr: string,
  isSimulation?: boolean
): { newlyCrossed: boolean; event: CrossoverEvent | null } {
  const isSim = isSimulation ?? (stock.feedSource === 'SIMULATED');

  // 1. Session Gate: Continuous regular market session MUST be active (>= 09:15:00 IST)
  // Bypassed when running in SIMULATION mode for testing & demos
  if (!isSim && !hasTodayMarketSessionStarted()) {
    stock.hasCrossed20D = false;
    stock.crossoverTime = null;
    stock.crossoverSpotPrice = null;
    stock.crossoverSignalType = undefined;
    stock.justCrossedHighlight = false;
    return { newlyCrossed: false, event: null };
  }

  const todayShares = stock.todayTradedShares !== undefined ? stock.todayTradedShares : Math.round(stock.todayVolM * 1_000_000);
  const avgShares = stock.avg20DTradedShares !== undefined ? stock.avg20DTradedShares : Math.round(stock.avgVol20DM * 1_000_000);

  // 2. Opening Stabilization Gate (09:15:00 to 09:16:00 IST):
  // Broker quote feeds often carry yesterday's cumulative EOD volume during the first 60 seconds.
  // In genuine market trading, it is physically impossible for a stock to trade 100% of its 20-day average volume
  // within the first 60 seconds of open. (Bypassed during simulation)
  if (!isSim) {
    const ist = getISTDate();
    const secsSinceOpen = (ist.hours * 3600 + ist.minutes * 60 + ist.seconds) - (9 * 3600 + 15 * 60);
    if (secsSinceOpen >= 0 && secsSinceOpen < 60) {
      if (todayShares >= avgShares * 0.5) {
        // Suppress anomalous opening spike (residual EOD cached volume)
        stock.hasCrossed20D = false;
        stock.crossoverTime = null;
        stock.crossoverSpotPrice = null;
        stock.crossoverSignalType = undefined;
        stock.justCrossedHighlight = false;
        return { newlyCrossed: false, event: null };
      }
    }
  }

  // Volume condition: Today volume must meet or exceed 20D average (> 0)
  const volumeCrossed = todayShares >= avgShares && todayShares > 0;

  // Rule 5: If volume has not crossed (e.g. Day Start or 0 before session start), clear any stale crossover latch
  if (todayShares < avgShares || todayShares === 0) {
    stock.hasCrossed20D = false;
    stock.crossoverTime = null;
    stock.crossoverSpotPrice = null;
    stock.crossoverSignalType = undefined;
    stock.justCrossedHighlight = false;
    return { newlyCrossed: false, event: null };
  }

  // Idempotency: Once a stock has already triggered/latched crossover, NEVER generate a duplicate event!
  if (stock.hasCrossed20D || Boolean(stock.crossoverTime)) {
    // Preserve latched status as volume is still >= 20D average
    stock.hasCrossed20D = true;
    return { newlyCrossed: false, event: null };
  }

  // Rule 1: Price direction evaluation at crossover trigger moment:
  // Bullish: LTP >= Day Open or changePct >= 0 -> BUY breakout
  // Bearish: LTP < Day Open and changePct < 0 -> SELL distribution
  const isBullish = stock.spotLtp >= (stock.dayOpen || stock.spotLtp) || (stock.changePct ?? 0) >= 0;
  const signalType: 'BUY' | 'SELL' = isBullish ? 'BUY' : 'SELL';

  if (volumeCrossed) {
    stock.hasCrossed20D = true;
    stock.crossoverTime = currentTimeStr;
    stock.crossoverSpotPrice = stock.spotLtp;
    stock.crossoverSignalType = signalType;
    stock.justCrossedHighlight = true;

    const event: CrossoverEvent = {
      ticker: stock.ticker,
      time: currentTimeStr,
      avgVol20DM: stock.avgVol20DM,
      avg20DTradedShares: avgShares,
      todayTradedShares: todayShares,
      crossPrice: stock.spotLtp,
      isFnO: stock.isFnO,
      signalType,
    };

    return { newlyCrossed: true, event };
  }

  return { newlyCrossed: false, event: null };
}
