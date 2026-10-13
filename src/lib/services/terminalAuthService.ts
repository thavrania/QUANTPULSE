import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

export const AUTH_COOKIE_NAME = 'qp_terminal_auth';
const DEFAULT_SECRET = 'quantpulse_multi_terminal_secret_key_2026';

function getSessionSecret(): string {
  return (process.env.AUTH_SESSION_SECRET || DEFAULT_SECRET).trim();
}

function getStoredMasterPassword(): string {
  // 1. Check environment variable
  const envPass = (process.env.TERMINAL_PASSWORD || '').trim();
  if (envPass) return envPass;

  // 2. Check Cred.txt in workspace root
  try {
    const credPath = path.join(process.cwd(), 'Cred.txt');
    if (fs.existsSync(credPath)) {
      const cred = fs.readFileSync(credPath, 'utf-8').trim();
      if (cred) return cred;
    }
  } catch {}

  // 3. Fallback default
  return 'Quant@0033.';
}

export function getConfiguredUsername(): string {
  return (process.env.TERMINAL_USERNAME || 'admin').trim();
}

export interface SessionPayload {
  username: string;
  iat: number;
  exp: number;
}

/**
 * Creates an HMAC-SHA256 signed session token
 */
export function createSessionToken(username: string, maxAgeDays: number = 7): string {
  const secret = getSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + maxAgeDays * 24 * 3600;

  const payload: SessionPayload = {
    username: username.trim(),
    iat: now,
    exp,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 signed session token
 */
export function verifySessionToken(token?: string | null): {
  valid: boolean;
  username?: string;
  error?: string;
} {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, error: 'Missing or malformed token' };
  }

  try {
    const [payloadB64, signature] = token.split('.');
    const secret = getSessionSecret();

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest('base64url');

    if (
      signature.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
    ) {
      return { valid: false, error: 'Invalid token signature' };
    }

    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    );

    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) {
      return { valid: false, error: 'Session token expired' };
    }

    return { valid: true, username: payload.username };
  } catch (err: any) {
    return { valid: false, error: `Token decode error: ${err.message}` };
  }
}

/**
 * Validates terminal login credentials
 */
export async function verifyTerminalCredentials(
  usernameInput: string,
  passwordInput: string
): Promise<{
  valid: boolean;
  username: string;
  error?: string;
}> {
  const userClean = (usernameInput || '').trim();
  const passClean = (passwordInput || '').trim();

  if (!userClean || !passClean) {
    return { valid: false, username: '', error: 'User name and Password are required.' };
  }

  // 1. Check Master Terminal Credentials
  const masterUser = getConfiguredUsername();
  const masterPass = getStoredMasterPassword();

  // Allow standard admin, quantpulse, trader aliases or configured username
  const isMasterUsernameMatch =
    userClean.toLowerCase() === masterUser.toLowerCase() ||
    userClean.toLowerCase() === 'admin' ||
    userClean.toLowerCase() === 'quantpulse' ||
    userClean.toLowerCase() === 'trader';

  const isMasterPasswordMatch = passClean === masterPass;

  if (isMasterUsernameMatch && isMasterPasswordMatch) {
    return {
      valid: true,
      username: userClean.toLowerCase() === 'admin' ? 'admin' : userClean,
    };
  }

  // 2. Check Supabase Auth if username resembles an email
  if (userClean.includes('@') && isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userClean,
        password: passClean,
      });

      if (!error && data?.session?.user) {
        return {
          valid: true,
          username: data.session.user.email || userClean,
        };
      }
    } catch {}
  }

  return {
    valid: false,
    username: '',
    error: 'Invalid User name or Password. Please check credentials.',
  };
}
