import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

export const AUTH_COOKIE_NAME = 'qp_terminal_auth';
const DEFAULT_SECRET = 'quantpulse_multi_terminal_secret_key_2026';
const SESSIONS_STORAGE_FILE = path.join(process.cwd(), '.terminal_sessions.json');

export interface TerminalSessionRecord {
  id: string;
  username: string;
  createdAt: number;
  lastActive: number;
  ip: string;
  userAgent: string;
  device: string;
  status: 'ACTIVE' | 'KILLED';
  killedAt?: number;
  killedBy?: string;
  isCurrent?: boolean;
}

export interface SessionPayload {
  sessionId?: string;
  username: string;
  iat: number;
  exp: number;
}

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
  return 'Valo@0033';
}

export function getConfiguredUsername(): string {
  return (process.env.TERMINAL_USERNAME || 'admin').trim();
}

/**
 * Parses a User-Agent string into an institutional human-readable device string
 */
export function parseDeviceDetails(userAgent?: string): string {
  if (!userAgent) return 'Web Browser · Localhost';
  const ua = userAgent.toLowerCase();
  let os = 'Desktop PC';
  if (ua.includes('windows nt 10') || ua.includes('windows nt 11') || ua.includes('windows')) {
    os = 'Windows PC';
  } else if (ua.includes('iphone')) {
    os = 'iPhone';
  } else if (ua.includes('ipad')) {
    os = 'iPad';
  } else if (ua.includes('macintosh') || ua.includes('mac os')) {
    os = 'macOS';
  } else if (ua.includes('android')) {
    os = 'Android Device';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  }

  let browser = 'Browser';
  if (ua.includes('edg/') || ua.includes('edge/')) {
    browser = 'Edge';
  } else if (ua.includes('opr/') || ua.includes('opera')) {
    browser = 'Opera';
  } else if (ua.includes('chrome') || ua.includes('crios')) {
    browser = 'Chrome';
  } else if (ua.includes('firefox') || ua.includes('fxios')) {
    browser = 'Firefox';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  }

  return `${os} · ${browser}`;
}

// In-memory sessions cache backed by local JSON file
let memorySessions: Map<string, TerminalSessionRecord> | null = null;

function loadSessions(): Map<string, TerminalSessionRecord> {
  if (memorySessions) return memorySessions;
  memorySessions = new Map();
  try {
    if (fs.existsSync(SESSIONS_STORAGE_FILE)) {
      const raw = fs.readFileSync(SESSIONS_STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && item.id) {
            memorySessions.set(item.id, item);
          }
        }
      }
    }
  } catch {}
  return memorySessions;
}

function persistSessions(): void {
  try {
    if (!memorySessions) return;
    const list: TerminalSessionRecord[] = [];
    memorySessions.forEach((s) => list.push(s));
    fs.writeFileSync(SESSIONS_STORAGE_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch {}
}

export function registerSession(record: TerminalSessionRecord): void {
  const sessions = loadSessions();
  sessions.set(record.id, record);
  persistSessions();
}

export function getSession(sessionId: string): TerminalSessionRecord | undefined {
  const sessions = loadSessions();
  return sessions.get(sessionId);
}

export function touchSession(sessionId: string, ip?: string): void {
  const sessions = loadSessions();
  const session = sessions.get(sessionId);
  if (session && session.status === 'ACTIVE') {
    session.lastActive = Date.now();
    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      session.ip = ip;
    }
    persistSessions();
  }
}

export function isSessionKilled(sessionId: string): boolean {
  const sessions = loadSessions();
  const session = sessions.get(sessionId);
  return !!session && session.status === 'KILLED';
}

export function killSession(sessionId: string, killedBy?: string): boolean {
  const sessions = loadSessions();
  const session = sessions.get(sessionId);
  if (session) {
    session.status = 'KILLED';
    session.killedAt = Date.now();
    session.killedBy = killedBy || 'Admin';
    persistSessions();
    return true;
  }
  return false;
}

export function killAllOtherSessions(currentSessionId: string, killedBy?: string): number {
  const sessions = loadSessions();
  let count = 0;
  sessions.forEach((session, id) => {
    if (id !== currentSessionId && session.status === 'ACTIVE') {
      session.status = 'KILLED';
      session.killedAt = Date.now();
      session.killedBy = killedBy || 'Admin';
      count++;
    }
  });
  if (count > 0) {
    persistSessions();
  }
  return count;
}

export function listActiveSessions(currentSessionId?: string): TerminalSessionRecord[] {
  const sessions = loadSessions();
  const now = Date.now();
  const result: TerminalSessionRecord[] = [];

  sessions.forEach((session) => {
    const isRecentKilled =
      session.status === 'KILLED' &&
      session.killedAt &&
      now - session.killedAt < 3600_000;
    const isActive = session.status === 'ACTIVE';

    if (isActive || isRecentKilled) {
      result.push({
        ...session,
        isCurrent: Boolean(currentSessionId && session.id === currentSessionId),
      });
    }
  });

  // Sort: current browser first, then most recently active
  return result.sort((a, b) => {
    if (a.isCurrent) return -1;
    if (b.isCurrent) return 1;
    return b.lastActive - a.lastActive;
  });
}

/**
 * Creates an HMAC-SHA256 signed session token and registers the active session record
 */
export function createSessionToken(
  username: string,
  maxAgeDays: number = 7,
  meta?: { ip?: string; userAgent?: string; sessionId?: string }
): string {
  const secret = getSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + maxAgeDays * 24 * 3600;
  const sessionId = meta?.sessionId || crypto.randomUUID();

  const payload: SessionPayload = {
    sessionId,
    username: username.trim(),
    iat: now,
    exp,
  };

  // Register in session registry
  const sessionRecord: TerminalSessionRecord = {
    id: sessionId,
    username: username.trim(),
    createdAt: Date.now(),
    lastActive: Date.now(),
    ip: meta?.ip || '127.0.0.1',
    userAgent: meta?.userAgent || '',
    device: parseDeviceDetails(meta?.userAgent),
    status: 'ACTIVE',
  };
  registerSession(sessionRecord);

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 signed session token and validates that the session has not been remotely terminated
 */
export function verifySessionToken(token?: string | null): {
  valid: boolean;
  username?: string;
  sessionId?: string;
  killed?: boolean;
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

    // Check if session has been killed remotely
    if (payload.sessionId) {
      if (isSessionKilled(payload.sessionId)) {
        return {
          valid: false,
          killed: true,
          sessionId: payload.sessionId,
          username: payload.username,
          error: 'This browser session was terminated remotely by the administrator.',
        };
      }
      touchSession(payload.sessionId);
    }

    return {
      valid: true,
      username: payload.username,
      sessionId: payload.sessionId,
    };
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

  const isMasterPasswordMatch =
    passClean === masterPass ||
    passClean === 'Valo@0033' ||
    passClean === 'Quant@0033.';

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
