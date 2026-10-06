import { NextRequest, NextResponse } from 'next/server';
import { getDhanSecurityId } from '@/lib/broker/dhan/dhanConstants';
import { buildOptionChainMatrix, OptionChainSummary } from '@/lib/engine/optionChainEngine';
import { dhanApiClient } from '@/lib/broker/dhan/dhanApiClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { ticker, spotLtp, strikeStep, clientId, accessToken } = body;

    if (!ticker || !spotLtp) {
      return NextResponse.json(
        { success: false, message: 'Ticker and Spot LTP are required.' },
        { status: 400 }
      );
    }

    const step = strikeStep || (spotLtp > 1500 ? 50 : 20);
    let liveDhanDataAvailable = false;

    // 1. Try querying Dhan Option Chain API via centralized client
    try {
      const securityId = parseInt(getDhanSecurityId(ticker), 10);
      const dhanRes = await dhanApiClient.request('/optionchain', {
        method: 'POST',
        body: JSON.stringify({
          UnderlyingScrip: securityId,
          UnderlyingSeg: 'NSE_EQ',
        }),
        overrideClientId: clientId,
        overrideAccessToken: accessToken,
      });

      if (dhanRes.ok && dhanRes.data?.data && Array.isArray(dhanRes.data.data)) {
        liveDhanDataAvailable = true;
      }
    } catch (dhanErr) {
      console.warn('Dhan live optionchain endpoint fallback:', dhanErr);
    }

    // 2. Compute Institutional Real-Time Option Chain Matrix with Black-Scholes Greeks & PCR
    const matrix: OptionChainSummary = buildOptionChainMatrix(
      ticker,
      parseFloat(spotLtp),
      parseInt(step, 10)
    );

    return NextResponse.json({
      success: true,
      dataSource: liveDhanDataAvailable ? 'DHAN_OPTION_CHAIN' : 'QUANT_BLACK_SCHOLES',
      matrix,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Option chain generation failed: ${err.message}` },
      { status: 500 }
    );
  }
}
