import { NextRequest, NextResponse } from 'next/server';
import { dhanApiClient } from '@/lib/broker/dhan/dhanApiClient';
import { dhanAuthService } from '@/lib/services/dhanAuthService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let { clientId, accessToken } = body;

    // If caller didn't provide explicit credentials, test server's active credentials
    if (!clientId || !accessToken) {
      try {
        const auth = await dhanAuthService.getValidAccessToken();
        clientId = clientId || auth.clientId;
        accessToken = accessToken || auth.accessToken;
      } catch (authErr: any) {
        return NextResponse.json(
          {
            success: false,
            message: `No active Dhan credentials found to test: ${authErr.message}`,
            broker: 'DHAN',
          },
          { status: 400 }
        );
      }
    }

    // Call Dhan v2 fundlimit endpoint to verify credentials and check latency
    const response = await dhanApiClient.request('/fundlimit', {
      method: 'GET',
      overrideClientId: clientId,
      overrideAccessToken: accessToken,
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        message: `Dhan Auth Failed (${response.status}): ${response.error || 'Unauthorized'}`,
        broker: 'DHAN',
        latencyMs: response.latencyMs,
      });
    }

    const data = response.data;
    const availCash = data?.availMargin ?? data?.sodLimit ?? 0;

    return NextResponse.json({
      success: true,
      message: 'Dhan HQ API v2 Authenticated Successfully!',
      broker: 'DHAN',
      availableCash: availCash,
      latencyMs: response.latencyMs,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: `Network/Gateway Error: ${err.message || 'Unable to connect to Dhan'}`,
        broker: 'DHAN',
      },
      { status: 500 }
    );
  }
}
