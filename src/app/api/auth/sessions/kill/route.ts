import { NextRequest, NextResponse } from 'next/server';
import {
  verifySessionToken,
  killSession,
  killAllOtherSessions,
  AUTH_COOKIE_NAME,
} from '@/lib/services/terminalAuthService';

export async function POST(req: NextRequest) {
  try {
    const cookieToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const authHeader = req.headers.get('Authorization');
    const headerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    const token = cookieToken || headerToken;
    const verification = verifySessionToken(token);

    if (!verification.valid || !verification.username) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { sessionId, killAllOthers } = body;

    let response: NextResponse;

    if (killAllOthers) {
      const currentSid = verification.sessionId || '';
      const killedCount = killAllOtherSessions(currentSid, verification.username);
      response = NextResponse.json({
        success: true,
        killedCount,
        message: `Successfully terminated ${killedCount} remote browser session(s).`,
      });
    } else if (sessionId) {
      const ok = killSession(sessionId, verification.username);
      if (!ok) {
        return NextResponse.json(
          { success: false, message: 'Session not found or already terminated.' },
          { status: 404 }
        );
      }

      response = NextResponse.json({
        success: true,
        message: 'Browser session terminated immediately.',
      });

      // If user killed their own current session, clear cookie
      if (sessionId === verification.sessionId) {
        response.cookies.set({
          name: AUTH_COOKIE_NAME,
          value: '',
          httpOnly: true,
          maxAge: 0,
          path: '/',
        });
      }
    } else {
      return NextResponse.json(
        { success: false, message: 'Must provide sessionId or killAllOthers.' },
        { status: 400 }
      );
    }

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Failed to terminate session: ${err.message}` },
      { status: 500 }
    );
  }
}
