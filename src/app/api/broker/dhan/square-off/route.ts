import { NextRequest, NextResponse } from 'next/server';
import { DHAN_BASE_URL, getDhanSecurityId } from '@/lib/broker/dhan/dhanConstants';
import { getActiveBrokerCredentials } from '@/lib/services/brokerVaultService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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

    // Resolve credentials if live and not provided
    let activeClientId = clientId;
    let activeAccessToken = accessToken;

    if (!isPaper && (!activeClientId || !activeAccessToken)) {
      const vault = await getActiveBrokerCredentials();
      activeClientId = activeClientId || vault.clientId;
      activeAccessToken = activeAccessToken || vault.accessToken;
    }

    // Paper Trading square off
    if (isPaper || !activeClientId || !activeAccessToken) {
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
    const isOption = instrumentType?.includes('OPTION');
    const exchangeSegment = isOption ? 'NSE_FNO' : 'NSE_EQ';
    const securityId = getDhanSecurityId(ticker);

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

    const dhanRes = await fetch(`${DHAN_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'access-token': activeAccessToken,
        'client-id': activeClientId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(squareOffPayload),
    });

    const data = await dhanRes.json();

    if (!dhanRes.ok || data.status === 'failure') {
      return NextResponse.json({
        success: false,
        mode: 'LIVE_DHAN',
        message: `Dhan square-off failed: ${data.remarks || JSON.stringify(data)}`,
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'LIVE_DHAN',
      positionId,
      orderId: data.orderId,
      exitStatus: 'CLOSED',
      exitTime,
      message: `Live Position ${symbol} squared off via Dhan (Order ID: ${data.orderId})`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Square-off error: ${err.message}` },
      { status: 500 }
    );
  }
}
