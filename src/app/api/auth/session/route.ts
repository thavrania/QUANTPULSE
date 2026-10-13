import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, AUTH_COOKIE_NAME } from '@/lib/services/terminalAuthService';

export async function GET(req: NextRequest) {
  try {
    const cookieToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const authHeader = req.headers.get('Authorization');
    const headerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    const token = cookieToken || headerToken;
    const verification = verifySessionToken(token);

    if (verification.valid && verification.username) {
      return NextResponse.json({
        authenticated: true,
        user: {
          username: verification.username,
          role: 'TRADER_AUTHORIZED',
        },
      });
    }

    return NextResponse.json({
      authenticated: false,
      message: verification.error || 'No active terminal session',
    });
  } catch (err: any) {
    return NextResponse.json(
      { authenticated: false, message: `Session check error: ${err.message}` },
      { status: 500 }
    );
  }
}
