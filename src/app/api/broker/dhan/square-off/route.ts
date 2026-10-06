import { NextRequest, NextResponse } from 'next/server';
import { getDhanSecurityId } from '@/lib/broker/dhan/dhanConstants';
import { dhanApiClient } from '@/lib/broker/dhan/dhanApiClient';
import { dhanAuthService } from '@/lib/services/dhanAuthService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      positionId,
      ticker,
      symbol,
      quantity,
      instrumentType,
      isPaper = true,
      clientId,
      accessToken,
    } = body;

    const exitTime = new Date().toLocaleTimeString('en-IN', { hour12: false });

    // Paper Trading square off
    if (isPaper) {
      return NextResponse.json({
        success: true,
        mode: 'PAPER',
        positionId,
        exitStatus: 'CLOSED',
        exitTime,
        message: `Position ${symbol} successfully squared off in Paper Engine.`,
      });
    }

    // Live Dhan square off (sell market order)
    const isOption = (instrumentType || '').includes('OPTION');
    const exchangeSegment = isOption ? 'NSE_FNO' : 'NSE_EQ';
    const securityId = getDhanSecurityId(ticker);

    let activeClientId = clientId;
    if (!activeClientId) {
      try {
        const auth = await dhanAuthService.getValidAccessToken();
        activeClientId = auth.clientId;
      } catch {}
    }

    const squareOffPayload = {
      dhanClientId: activeClientId,
      transactionType: 'SELL',
      exchangeSegment: exchangeSegment,
      productType: 'INTRADAY',
      orderType: 'MARKET',
      validity: 'DAY',
      securityId: securityId,
      quantity: parseInt(quantity, 10),
      price: 0,
      triggerPrice: 0,
    };

    const dhanRes = await dhanApiClient.request('/orders', {
      method: 'POST',
      body: JSON.stringify(squareOffPayload),
      overrideClientId: clientId,
      overrideAccessToken: accessToken,
    });

    const data = dhanRes.data;

    if (!dhanRes.ok || data?.status === 'failure') {
      const errorMsg =
        data?.remarks ||
        data?.errorMessage ||
        dhanRes.error ||
        JSON.stringify(data || {});
      const isInvalidIp =
        errorMsg.toLowerCase().includes('invalid ip') ||
        errorMsg.includes('DH-905') ||
        errorMsg.includes('905');

      let detailedMessage = `Dhan square-off failed: ${errorMsg}`;

      if (isInvalidIp) {
        let serverIp = 'UNKNOWN';
        try {
          const ipRes = await fetch('https://api.ipify.org?format=json', {
            signal: AbortSignal.timeout(2000),
            cache: 'no-store',
          });
          if (ipRes.ok) {
            const d = await ipRes.json();
            if (d?.ip) serverIp = d.ip;
          }
        } catch {}

        detailedMessage = `Dhan square-off failed: Invalid IP. Server IP '${serverIp}' is not whitelisted on Dhan.`;
      }

      return NextResponse.json({
        success: false,
        mode: 'LIVE_DHAN',
        message: detailedMessage,
        isInvalidIp,
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'LIVE_DHAN',
      positionId,
      orderId: data?.orderId,
      exitStatus: 'CLOSED',
      exitTime,
      message: `Live Position ${symbol} squared off via Dhan (Order ID: ${data?.orderId})`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Square-off error: ${err.message}` },
      { status: 500 }
    );
  }
}
