import { NextRequest, NextResponse } from 'next/server';
import { dhanAuthService } from '@/lib/services/dhanAuthService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get('tokenId') || searchParams.get('token_id');
    const errorParam = searchParams.get('error') || searchParams.get('error_description');

    if (errorParam) {
      console.warn('[Dhan Callback] Error returned in query params:', errorParam);
      return NextResponse.redirect(
        new URL(`/?dhan_auth=error&error=${encodeURIComponent(errorParam)}`, req.url)
      );
    }

    if (!tokenId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing tokenId in callback parameters.',
        },
        { status: 400 }
      );
    }

    const consumeResult = await dhanAuthService.consumeConsentToken(tokenId);

    if (!consumeResult.success) {
      console.error('[Dhan Callback] Failed to consume consent token:', consumeResult.message);
      return NextResponse.redirect(
        new URL(
          `/?dhan_auth=failed&error=${encodeURIComponent(consumeResult.message || 'Token exchange failed')}`,
          req.url
        )
      );
    }

    // Success: redirect user to app root with success query param
    return NextResponse.redirect(new URL('/?dhan_auth=success', req.url));
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: `Callback handling error: ${err.message}`,
      },
      { status: 500 }
    );
  }
}
