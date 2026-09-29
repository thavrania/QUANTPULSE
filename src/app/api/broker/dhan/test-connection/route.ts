import { NextRequest, NextResponse } from 'next/server';
import { DHAN_BASE_URL } from '@/lib/broker/dhan/dhanConstants';

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { clientId, accessToken } = body;

    if (!clientId || !accessToken) {
      return NextResponse.json(
        {
          success: false,
          message: 'Client ID and Access Token are required.',
          broker: 'DHAN',
        },
        { status: 400 }
      );
    }

    // Call Dhan v2 fundlimit endpoint to verify credentials and check latency
    const response = await fetch(`${DHAN_BASE_URL}/fundlimit`, {
      method: 'GET',
      headers: {
        'access-token': accessToken,
        'client-id': clientId,
        'Content-Type': 'application/json',
      },
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      let parsedError = errorText;
      try {
        const jsonErr = JSON.parse(errorText);
        parsedError = jsonErr.errorMessage || jsonErr.message || errorText;
      } catch {
        // use raw text
      }

      return NextResponse.json({
        success: false,
        message: `Dhan Auth Failed (${response.status}): ${parsedError}`,
        broker: 'DHAN',
        latencyMs,
      });
    }

    const data = await response.json();
    const availCash = data?.availMargin ?? data?.sodLimit ?? 0;

    return NextResponse.json({
      success: true,
      message: 'Dhan HQ API v2 Authenticated Successfully!',
      broker: 'DHAN',
      availableCash: availCash,
      latencyMs,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json(
      {
        success: false,
        message: `Network/Gateway Error: ${err.message || 'Unable to connect to Dhan'}`,
        broker: 'DHAN',
        latencyMs,
      },
      { status: 500 }
    );
  }
}
