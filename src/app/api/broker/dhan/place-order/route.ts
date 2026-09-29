import { NextRequest, NextResponse } from 'next/server';
import { DHAN_BASE_URL, getDhanSecurityId } from '@/lib/broker/dhan/dhanConstants';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
    if (isPaper || !clientId || !accessToken) {
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
    const isOption = instrumentType.includes('OPTION');
    const exchangeSegment = isOption ? 'NSE_FNO' : 'NSE_EQ';
    const securityId = getDhanSecurityId(ticker);

    const dhanOrderPayload = {
      dhanClientId: clientId,
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

    const dhanResponse = await fetch(`${DHAN_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'access-token': accessToken,
        'client-id': clientId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dhanOrderPayload),
    });

    const dhanData = await dhanResponse.json();

    if (!dhanResponse.ok || dhanData.status === 'failure') {
      const errorMsg = dhanData.remarks || dhanData.errorMessage || JSON.stringify(dhanData);
      return NextResponse.json({
        success: false,
        mode: 'LIVE_DHAN',
        message: `Dhan Order Rejected: ${errorMsg}`,
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'LIVE_DHAN',
      orderId: dhanData.orderId,
      orderStatus: dhanData.orderStatus || 'PENDING',
      symbol,
      action,
      quantity,
      fillPrice: price,
      orderTime,
      message: `Live Order Dispatched to Dhan: ${action} ${quantity} ${symbol} (Order ID: ${dhanData.orderId})`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `OMS Execution error: ${err.message}` },
      { status: 500 }
    );
  }
}
