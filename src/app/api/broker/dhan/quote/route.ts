import { NextRequest, NextResponse } from 'next/server';
import { DHAN_BASE_URL, getDhanSecurityId } from '@/lib/broker/dhan/dhanConstants';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tickers, clientId, accessToken } = body;

    if (!clientId || !accessToken) {
      return NextResponse.json(
        { success: false, message: 'Client ID and Access Token are required.' },
        { status: 400 }
      );
    }

    const tickerList: string[] = Array.isArray(tickers) && tickers.length > 0 ? tickers : ['RELIANCE', 'TATAMOTORS', 'TCS'];
    const securityIds = tickerList.map((t) => parseInt(getDhanSecurityId(t), 10));

    // Request quotes from Dhan Marketfeed API
    const response = await fetch(`${DHAN_BASE_URL}/marketfeed/quote`, {
      method: 'POST',
      headers: {
        'access-token': accessToken,
        'client-id': clientId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        NSE_EQ: securityIds,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({
        success: false,
        message: `Dhan Quote API error (${response.status}): ${errText}`,
      });
    }

    const quoteData = await response.json();
    const nseData = quoteData?.data?.NSE_EQ || {};

    const quotes: Record<string, { ltp: number; volumeM: number; high: number; low: number }> = {};

    tickerList.forEach((sym) => {
      const secId = getDhanSecurityId(sym);
      const item = nseData[secId];
      if (item) {
        quotes[sym] = {
          ltp: item.last_price || item.close || 0,
          volumeM: +((item.volume || 0) / 1_000_000).toFixed(3),
          high: item.high || 0,
          low: item.low || 0,
        };
      }
    });

    return NextResponse.json({
      success: true,
      quotes,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Failed to fetch live quote: ${err.message}` },
      { status: 500 }
    );
  }
}
