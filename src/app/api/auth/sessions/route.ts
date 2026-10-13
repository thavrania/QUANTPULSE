import { NextRequest, NextResponse } from 'next/server';
import {
  verifySessionToken,
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

    if (!verification.valid || !verification.username) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const sessions = listActiveSessions(verification.sessionId);
    const activeCount = sessions.filter((s) => s.status === 'ACTIVE').length;

    return NextResponse.json({
      success: true,
      currentSessionId: verification.sessionId,
      activeCount,
      sessions,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Failed to fetch sessions: ${err.message}` },
      { status: 500 }
    );
  }
}
