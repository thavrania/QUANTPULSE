import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/services/terminalAuthService';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully. Terminal locked.',
  });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
