import { NextRequest, NextResponse } from 'next/server';
import { DHAN_BASE_URL, getDhanSecurityId } from '@/lib/broker/dhan/dhanConstants';
import { getActiveBrokerCredentials } from '@/lib/services/brokerVaultService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticker, clientId, accessToken } = body;

    let cid = clientId;
    let token = accessToken;

    if (!cid || !token) {
      const vault = await getActiveBrokerCredentials();
      cid = cid || vault.clientId;
      token = token || vault.accessToken;
    }

    if (!ticker || !cid || !token) {
      return NextResponse.json(
        { success: false, message: 'Ticker, Client ID, and Access Token are required (or configure Cloud Vault).' },
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

    const response = await fetch(`${DHAN_BASE_URL}/charts/historical`, {
      method: 'POST',
      headers: {
        'access-token': token,
        'client-id': cid,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({
        success: false,
        message: `Dhan Historical API error (${response.status}): ${errText}`,
      });
    }

    const chartData = await response.json();
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
    const avgVolume20D = sumVolume / last20Bars.length;
    const avgVolume20DM = +(avgVolume20D / 1_000_000).toFixed(3);

    return NextResponse.json({
      success: true,
      ticker,
      securityId,
      avgVolume20DM,
      barsEvaluated: last20Bars.length,
      sampleVolumesM: last20Bars.slice(-5).map((v) => +(v / 1_000_000).toFixed(2)),
      calculatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Historical calculation failed: ${err.message}` },
      { status: 500 }
    );
  }
}
