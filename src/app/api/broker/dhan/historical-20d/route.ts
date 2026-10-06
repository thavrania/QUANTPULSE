import { NextRequest, NextResponse } from 'next/server';
import { getDhanSecurityId } from '@/lib/broker/dhan/dhanConstants';
import { dhanApiClient } from '@/lib/broker/dhan/dhanApiClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { ticker, clientId, accessToken } = body;

    if (!ticker) {
      return NextResponse.json(
        { success: false, message: 'Ticker symbol is required.' },
        { status: 400 }
      );
    }

    const securityId = getDhanSecurityId(ticker);

    // Calculate dates: from 45 days ago to today (to ensure we capture at least 20 trading sessions)
    const today = new Date();
    const toDateStr = today.toISOString().split('T')[0];
    const fromDate = new Date();
    fromDate.setDate(today.getDate() - 45);
    const fromDateStr = fromDate.toISOString().split('T')[0];

    const payload = {
      securityId: securityId,
      exchangeSegment: 'NSE_EQ',
      instrument: 'EQUITY',
      fromDate: fromDateStr,
      toDate: toDateStr,
    };

    const response = await dhanApiClient.request('/charts/historical', {
      method: 'POST',
      body: JSON.stringify(payload),
      overrideClientId: clientId,
      overrideAccessToken: accessToken,
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        message: response.error || `Dhan Historical API error (${response.status})`,
      });
    }

    const chartData = response.data;
    const volumes: number[] = chartData?.volume || [];

    if (volumes.length < 5) {
      return NextResponse.json({
        success: false,
        message: `Insufficient volume history returned for ${ticker} (${volumes.length} bars found).`,
      });
    }

    // Take the last 20 completed trading sessions
    const last20Bars = volumes.slice(-20);
    const sumVolume = last20Bars.reduce((sum, v) => sum + (v || 0), 0);
    const avgVolume20D = Math.round(sumVolume / last20Bars.length);
    const avgVolume20DM = avgVolume20D / 1_000_000;

    return NextResponse.json({
      success: true,
      ticker,
      securityId,
      avgVolume20DM,
      avg20DTradedShares: avgVolume20D,
      totalVolumeSumShares: sumVolume,
      barsEvaluated: last20Bars.length,
      sampleVolumesM: last20Bars.slice(-5).map((v) => +(v / 1_000_000).toFixed(3)),
      calculatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Historical calculation failed: ${err.message}` },
      { status: 500 }
    );
  }
}
