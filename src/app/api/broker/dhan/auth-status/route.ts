import { NextRequest, NextResponse } from 'next/server';
import { dhanAuthService } from '@/lib/services/dhanAuthService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = await dhanAuthService.getAuthStatus();

    return NextResponse.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: `Failed to retrieve Dhan auth status: ${err.message}`,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const forceRefresh = Boolean(body.forceRefresh || body.refresh);

    if (forceRefresh) {
      await dhanAuthService.getValidAccessToken({ forceRefresh: true });
    }

    const status = await dhanAuthService.getAuthStatus();

    return NextResponse.json({
      success: true,
      message: forceRefresh ? 'Dhan Access Token refreshed successfully.' : 'Status retrieved.',
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: `Dhan Token Refresh failed: ${err.message}`,
      },
      { status: 500 }
    );
  }
}
