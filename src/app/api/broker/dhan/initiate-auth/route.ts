import { NextRequest, NextResponse } from 'next/server';
import { dhanAuthService } from '@/lib/services/dhanAuthService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const redirectMode = searchParams.get('mode') === 'redirect';

    const result = await dhanAuthService.generateConsentLoginUrl();

    if (!result.success || !result.consentUrl) {
      return NextResponse.json(
        {
          success: false,
          message: result.message || 'Unable to generate Dhan consent login URL.',
        },
        { status: 400 }
      );
    }

    if (redirectMode) {
      return NextResponse.redirect(result.consentUrl);
    }

    return NextResponse.json({
      success: true,
      consentUrl: result.consentUrl,
      consentAppId: result.consentAppId,
      message: 'Open consentUrl in browser to authenticate with Dhan.',
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: `Failed to initiate Dhan authentication: ${err.message}`,
      },
      { status: 500 }
    );
  }
}
