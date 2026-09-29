import { NextRequest, NextResponse } from 'next/server';
import { DHAN_BASE_URL, getDhanSecurityId } from '@/lib/broker/dhan/dhanConstants';
import { getActiveBrokerCredentials } from '@/lib/services/brokerVaultService';

export interface LiveQuoteRecord {
  ltp: number;
  volumeM: number;
  high: number;
  low: number;
  open: number;
  close: number;
  changePct: number;
  averagePrice?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tickers, clientId, accessToken } = body;

    let cid = clientId;
    let token = accessToken;

    if (!cid || !token) {
      const vault = await getActiveBrokerCredentials();
      cid = cid || vault.clientId;
      token = token || vault.accessToken;
    }

    if (!cid || !token) {
      return NextResponse.json(
        {
          success: false,
          isConfigured: false,
          message: 'Dhan Client ID and Access Token are required. Please configure in Broker settings or Cloud Vault.',
        },
        { status: 400 }
      );
    }

    const tickerList: string[] =
      Array.isArray(tickers) && tickers.length > 0
        ? tickers
        : ['RELIANCE', 'TATAMOTORS', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'ZOMATO'];

    const securityIds = tickerList.map((t) => parseInt(getDhanSecurityId(t), 10));

    // Request quotes from Dhan Marketfeed API (Batch multi-instrument quote)
    const response = await fetch(`${DHAN_BASE_URL}/marketfeed/quote`, {
      method: 'POST',
      headers: {
        'access-token': token,
        'client-id': cid,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        NSE_EQ: securityIds,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({
        success: false,
        isConfigured: true,
        message: `Dhan Quote API error (${response.status}): ${errText}`,
      });
    }

    const quoteData = await response.json();
    const nseData = quoteData?.data?.NSE_EQ || {};

    const quotes: Record<string, LiveQuoteRecord> = {};

    tickerList.forEach((sym) => {
      const secId = getDhanSecurityId(sym);
      const item = nseData[secId];
      if (item) {
        const ltp = item.last_price || item.close || 0;
        const close = item.close || ltp;
        const calcChange = close > 0 ? +(((ltp - close) / close) * 100).toFixed(2) : 0;

        quotes[sym] = {
          ltp: +(ltp).toFixed(2),
          volumeM: +((item.volume || 0) / 1_000_000).toFixed(3),
          high: +(item.high || ltp).toFixed(2),
          low: +(item.low || ltp).toFixed(2),
          open: +(item.open || ltp).toFixed(2),
          close: +(close).toFixed(2),
          changePct: item.change_percent !== undefined ? +item.change_percent.toFixed(2) : calcChange,
          averagePrice: item.average_price ? +(item.average_price).toFixed(2) : undefined,
        };
      }
    });

    return NextResponse.json({
      success: true,
      isConfigured: true,
      count: Object.keys(quotes).length,
      quotes,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Failed to fetch live quotes: ${err.message}` },
      { status: 500 }
    );
  }
}
