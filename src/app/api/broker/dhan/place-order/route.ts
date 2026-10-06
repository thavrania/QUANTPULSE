import { NextRequest, NextResponse } from 'next/server';
import { getDhanSecurityId } from '@/lib/broker/dhan/dhanConstants';
import { dhanApiClient } from '@/lib/broker/dhan/dhanApiClient';
import { dhanAuthService } from '@/lib/services/dhanAuthService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      ticker,
      instrumentType, // 'STOCK (EQUITY)' | 'OPTION (ATM CALL)'
      symbol,
      action, // 'BUY' | 'SELL'
      quantity,
      price,
      stopLossPrice,
      targetPrice,
      isPaper = true,
      clientId,
      accessToken,
    } = body;

    if (!ticker || !symbol || !quantity || !action) {
      return NextResponse.json(
        { success: false, message: 'Missing required order parameters.' },
        { status: 400 }
      );
    }

    const orderTime = new Date().toLocaleTimeString('en-IN', { hour12: false });

    // =====================================================================
    // 1. PAPER TRADING ENGINE (Virtual Execution against real price)
    // =====================================================================
    if (isPaper) {
      const paperOrderId = `PAPER-${Math.floor(100000 + Math.random() * 900000)}`;

      return NextResponse.json({
        success: true,
        mode: 'PAPER',
        orderId: paperOrderId,
        orderStatus: 'TRADED',
        exchangeOrderId: `SIM-NSE-${Math.floor(10000000 + Math.random() * 90000000)}`,
        symbol,
        action,
        quantity,
        fillPrice: price,
        orderTime,
        message: `Paper Order Filled: ${action} ${quantity} ${symbol} @ ₹${Number(price).toFixed(2)}`,
      });
    }

    // =====================================================================
    // 2. LIVE DHAN HQ ORDER ROUTING (Real Capital Execution)
    // =====================================================================
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

    const dhanOrderPayload = {
      dhanClientId: activeClientId,
      transactionType: action,
      exchangeSegment: exchangeSegment,
      productType: 'INTRADAY', // MIS intraday for algorithmic volume crossover terminal
      orderType: 'MARKET', // Market order for immediate volume breakout execution
      validity: 'DAY',
      securityId: securityId,
      quantity: parseInt(quantity, 10),
      price: 0, // 0 for Market order
      triggerPrice: 0,
      afterMarketOrder: false,
    };

    const dhanResponse = await dhanApiClient.request('/orders', {
      method: 'POST',
      body: JSON.stringify(dhanOrderPayload),
      overrideClientId: clientId,
      overrideAccessToken: accessToken,
    });

    const dhanData = dhanResponse.data;

    if (!dhanResponse.ok || dhanData?.status === 'failure') {
      const errorMsg =
        dhanData?.remarks ||
        dhanData?.errorMessage ||
        dhanResponse.error ||
        JSON.stringify(dhanData || {});
      const isInvalidIp =
        errorMsg.toLowerCase().includes('invalid ip') ||
        errorMsg.includes('DH-905') ||
        errorMsg.includes('905');

      let detailedMessage = `Dhan Order Rejected: ${errorMsg}`;

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

        const isVercel = Boolean(process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV);
        if (isVercel) {
          detailedMessage = `Dhan Order Rejected: Invalid IP (Serverless IP ${serverIp}). Dhan requires a static whitelisted IP in Dhan Web -> Profile -> Trading & Data API -> IP Setup. Note: Vercel serverless IPs rotate dynamically. For live trading with Dhan, run QuantPulse locally (npm run dev) with your broadband static IP whitelisted, or switch to Paper Trading mode.`;
        } else {
          detailedMessage = `Dhan Order Rejected: Invalid IP. Server outbound IP is '${serverIp}'. Please whitelist '${serverIp}' in Dhan Web Portal (Profile > Get Trading & Data API > IP Setup).`;
        }
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
      orderId: dhanData?.orderId,
      orderStatus: dhanData?.orderStatus || 'PENDING',
      symbol,
      action,
      quantity,
      fillPrice: price,
      orderTime,
      message: `Live Order Dispatched to Dhan: ${action} ${quantity} ${symbol} (Order ID: ${dhanData?.orderId})`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `OMS Execution error: ${err.message}` },
      { status: 500 }
    );
  }
}
