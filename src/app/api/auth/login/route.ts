import { NextRequest, NextResponse } from 'next/server';
import {
  verifyTerminalCredentials,
  createSessionToken,
  AUTH_COOKIE_NAME,
} from '@/lib/services/terminalAuthService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, password, rememberMe } = body;

    const result = await verifyTerminalCredentials(username, password);

    if (!result.valid) {
      return NextResponse.json(
        { success: false, message: result.error || 'Invalid credentials' },
        { status: 401 }
      );
    }

    const maxAgeDays = rememberMe ? 30 : 7;
    const token = createSessionToken(result.username, maxAgeDays);

    const response = NextResponse.json({
      success: true,
      user: {
        username: result.username,
        role: 'TRADER_AUTHORIZED',
      },
      message: 'Terminal access granted.',
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeDays * 24 * 3600,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Login error: ${err.message}` },
      { status: 500 }
    );
  }
}
