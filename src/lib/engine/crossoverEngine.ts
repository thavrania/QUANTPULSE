import { Stock, CrossoverEvent, VolumeMetrics } from '../types/quant';

export const INITIAL_WATCHLIST_DATA: Stock[] = [
  {
    ticker: 'RELIANCE',
    name: 'Reliance Industries',
    isFnO: true,
    lotSize: 250,
    strikeStep: 50,
    spotLtp: 2968.50,
    todayVolM: 5.82,
    avgVol20DM: 5.20,
    hasCrossed20D: true,
    crossoverTime: '09:48:12',
    crossoverSpotPrice: 2954.00,
    ivPct: 18.4,
    justCrossedHighlight: false,
  },
  {
    ticker: 'TATAMOTORS',
    name: 'Tata Motors Ltd',
    isFnO: true,
    lotSize: 550,
    strikeStep: 20,
    spotLtp: 984.40,
    todayVolM: 9.45,
    avgVol20DM: 8.90,
    hasCrossed20D: true,
    crossoverTime: '10:19:05',
    crossoverSpotPrice: 976.50,
    ivPct: 23.8,
    justCrossedHighlight: false,
  },
  {
    ticker: 'TCS',
    name: 'Tata Consultancy Services',
    isFnO: true,
    lotSize: 175,
    strikeStep: 50,
    spotLtp: 4126.00,
    todayVolM: 1.45,
    avgVol20DM: 1.50,
    hasCrossed20D: false,
    crossoverTime: null,
    crossoverSpotPrice: null,
    ivPct: 16.2,
    justCrossedHighlight: false,
  },
  {
    ticker: 'ZOMATO',
    name: 'Zomato Ltd (Cash Only)',
    isFnO: false,
    lotSize: 1,
    strikeStep: 5,
    spotLtp: 264.80,
    todayVolM: 18.47,
    avgVol20DM: 19.00,
    hasCrossed20D: false,
    crossoverTime: null,
    crossoverSpotPrice: null,
    ivPct: 0,
    justCrossedHighlight: false,
  },
  {
    ticker: 'ICICIBANK',
    name: 'ICICI Bank Ltd',
    isFnO: true,
    lotSize: 700,
    strikeStep: 20,
    spotLtp: 1258.00,
    todayVolM: 6.44,
    avgVol20DM: 7.00,
    hasCrossed20D: false,
    crossoverTime: null,
    crossoverSpotPrice: null,
    ivPct: 15.6,
    justCrossedHighlight: false,
  },
  {
    ticker: 'HDFCBANK',
    name: 'HDFC Bank Ltd',
    isFnO: true,
    lotSize: 550,
    strikeStep: 20,
    spotLtp: 1644.20,
    todayVolM: 4.70,
    avgVol20DM: 6.00,
    hasCrossed20D: false,
    crossoverTime: null,
    crossoverSpotPrice: null,
    ivPct: 14.9,
    justCrossedHighlight: false,
  },
];

export const INITIAL_CROSSOVER_LOGS: CrossoverEvent[] = [
  {
    ticker: 'TATAMOTORS',
    time: '10:19:05',
    avgVol20DM: 8.90,
    crossPrice: 976.50,
    isFnO: true,
  },
  {
    ticker: 'RELIANCE',
    time: '09:48:12',
    avgVol20DM: 5.20,
    crossPrice: 2954.00,
    isFnO: true,
  },
];

export function formatClockIST(totalSeconds: number): string {
  const secsInDay = totalSeconds % 86400;
  const hrs = String(Math.floor(secsInDay / 3600)).padStart(2, '0');
  const mins = String(Math.floor((secsInDay % 3600) / 60)).padStart(2, '0');
  const secs = String(secsInDay % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

export function getVolumeScreenerMetrics(stock: Stock): VolumeMetrics {
  const progressPct = +((stock.todayVolM / Math.max(stock.avgVol20DM, 0.001)) * 100).toFixed(1);
  const rvolRatio = +(stock.todayVolM / Math.max(stock.avgVol20DM, 0.001)).toFixed(2);
  const deficitM = Math.max(0, +(stock.avgVol20DM - stock.todayVolM).toFixed(3));
  const isEligibleForBuy = stock.hasCrossed20D || stock.todayVolM >= stock.avgVol20DM;

  return {
    progressPct,
    rvolRatio,
    deficitM,
    isEligibleForBuy,
    statusCode: isEligibleForBuy ? 'ELIGIBLE_FOR_BUY' : 'TRACKING_VOLUME',
    statusBadge: isEligibleForBuy ? 'ELIGIBLE FOR BUY' : 'TRACKING VOL (< 20D)',
  };
}

export function checkAndLatchVolumeCrossover(
  stock: Stock,
  currentTimeStr: string
): { newlyCrossed: boolean; event: CrossoverEvent | null } {
  if (!stock.hasCrossed20D && stock.todayVolM >= stock.avgVol20DM) {
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
