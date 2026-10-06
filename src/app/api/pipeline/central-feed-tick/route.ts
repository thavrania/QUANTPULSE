import { NextRequest, NextResponse } from 'next/server';
import { centralMarketDataService } from '@/lib/services/centralMarketDataService';

export async function GET(req: NextRequest) {
  try {
    const hasLease = await centralMarketDataService.acquireOrRenewLease('SERVERLESS_CRON', 10);
    if (!hasLease) {
      return NextResponse.json({
        success: true,
        message: 'Active worker holds feed lease. Standby mode.',
      });
    }

    const result = await centralMarketDataService.ingestMarketTick('SERVERLESS_CRON');
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Central feed tick error: ${err.message}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
