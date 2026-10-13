import { NextRequest, NextResponse } from 'next/server';
import {
  verifySessionToken,
  touchSession,
  listActiveSessions,
  AUTH_COOKIE_NAME,
} from '@/lib/services/terminalAuthService';

export async function GET(req: NextRequest) {
  try {
    const cookieToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const authHeader = req.headers.get('Authorization');
    const headerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    const token = cookieToken || headerToken;
    const verification = verifySessionToken(token);

    if (verification.killed) {
      const response = NextResponse.json(
        {
          authenticated: false,
          killed: true,
          message:
            verification.error ||
            'This browser session was terminated remotely by the administrator.',
        },
        { status: 401 }
      );
      response.cookies.set({
        name: AUTH_COOKIE_NAME,
        value: '',
        httpOnly: true,
        maxAge: 0,
        path: '/',
      });
      return response;
    }

    if (verification.valid && verification.username) {
      const forwarded = req.headers.get('x-forwarded-for');
      const ip =
        (forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip')) ||
        '127.0.0.1';

      if (verification.sessionId) {
        touchSession(verification.sessionId, ip);
      }

      const activeSessions = listActiveSessions(verification.sessionId);
      const activeCount = activeSessions.filter((s) => s.status === 'ACTIVE').length;

      return NextResponse.json({
        authenticated: true,
        sessionId: verification.sessionId,
        user: {
          username: verification.username,
          role: 'TRADER_AUTHORIZED',
        },
        activeSessionsCount: activeCount,
      });
    }

    return NextResponse.json({
      authenticated: false,
      killed: false,
      message: verification.error || 'No active terminal session',
    });
  } catch (err: any) {
    return NextResponse.json(
      { authenticated: false, message: `Session check error: ${err.message}` },
      { status: 500 }
    );
  }
}
