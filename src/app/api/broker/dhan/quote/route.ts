import { NextRequest, NextResponse } from 'next/server';
import { centralMarketDataService } from '@/lib/services/centralMarketDataService';

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
    const body = await req.json().catch(() => ({}));
    const { tickers } = body;

    const tickerList: string[] | undefined =
      Array.isArray(tickers) && tickers.length > 0 ? tickers : undefined;

    // Route through the Centralized Market Data Service.
    // Serves immediately from the coalesced centralized snapshot cache (<2.5s)
    // without triggering redundant external requests to Dhan HQ or Yahoo Finance.
    const { quotes, source, timestamp } = await centralMarketDataService.getQuotesOrRefresh(tickerList);

    return NextResponse.json({
      success: true,
      isConfigured: true,
      count: Object.keys(quotes).length,
      quotes,
      source: `CENTRALIZED_${source}`,
      notice: 'Centralized Market Feed Active (Zero Redundant Polling).',
      timestamp,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Failed to fetch centralized live quotes: ${err.message}` },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
