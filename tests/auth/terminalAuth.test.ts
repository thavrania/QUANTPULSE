import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionToken,
  verifySessionToken,
  verifyTerminalCredentials,
  getConfiguredUsername,
} from '../../src/lib/services/terminalAuthService';

test('AUTH: verifyTerminalCredentials succeeds with valid master password', async () => {
  const result = await verifyTerminalCredentials('admin', 'Valo@0033');
  assert.equal(result.valid, true);
  assert.equal(result.username, 'admin');

  // Also verify legacy password compatibility
  const legacyResult = await verifyTerminalCredentials('admin', 'Quant@0033.');
  assert.equal(legacyResult.valid, true);
});

test('AUTH: verifyTerminalCredentials supports common aliases case-insensitively', async () => {
  const res1 = await verifyTerminalCredentials('Admin', 'Valo@0033');
  assert.equal(res1.valid, true);

  const res2 = await verifyTerminalCredentials('QuantPulse', 'Valo@0033');
  assert.equal(res2.valid, true);

  const res3 = await verifyTerminalCredentials('trader', 'Valo@0033');
  assert.equal(res3.valid, true);
});

test('AUTH: verifyTerminalCredentials rejects wrong password', async () => {
  const result = await verifyTerminalCredentials('admin', 'wrong_password_123');
  assert.equal(result.valid, false);
  assert.ok(result.error);
});

test('AUTH: verifyTerminalCredentials rejects empty credentials', async () => {
  const res1 = await verifyTerminalCredentials('', '');
  assert.equal(res1.valid, false);

  const res2 = await verifyTerminalCredentials('admin', '');
  assert.equal(res2.valid, false);
});

test('AUTH: createSessionToken generates valid HMAC signed token', () => {
  const token = createSessionToken('admin', 7);
  assert.ok(token.includes('.'));

  const verification = verifySessionToken(token);
  assert.equal(verification.valid, true);
  assert.equal(verification.username, 'admin');
});

test('AUTH: verifySessionToken detects and rejects tampered token', () => {
  const token = createSessionToken('admin', 7);
  const [b64, sig] = token.split('.');
  const tamperedSig = sig.slice(0, -3) + 'xyz';
  const tamperedToken = `${b64}.${tamperedSig}`;

  const result = verifySessionToken(tamperedToken);
  assert.equal(result.valid, false);
  assert.equal(result.error, 'Invalid token signature');
});

test('AUTH: verifySessionToken rejects expired token', () => {
  // Create token with negative expiry
  const token = createSessionToken('admin', -1);
  const result = verifySessionToken(token);
  assert.equal(result.valid, false);
  assert.equal(result.error, 'Session token expired');
});

test('AUTH: parseDeviceDetails identifies desktop and mobile user agents', async () => {
  const { parseDeviceDetails } = await import('../../src/lib/services/terminalAuthService');
  const winChrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  assert.equal(parseDeviceDetails(winChrome), 'Windows PC · Chrome');

  const iphoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  assert.equal(parseDeviceDetails(iphoneSafari), 'iPhone · Safari');
});

test('AUTH: session tracking registers active session with IP and device', async () => {
  const { listActiveSessions } = await import('../../src/lib/services/terminalAuthService');
  const token = createSessionToken('admin', 7, {
    ip: '192.168.1.50',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0',
  });

  const verification = verifySessionToken(token);
  assert.equal(verification.valid, true);
  assert.ok(verification.sessionId);

  const activeSessions = listActiveSessions(verification.sessionId);
  const found = activeSessions.find((s) => s.id === verification.sessionId);
  assert.ok(found);
  assert.equal(found.ip, '192.168.1.50');
  assert.equal(found.isCurrent, true);
  assert.equal(found.status, 'ACTIVE');
});

test('AUTH: killSession marks session as KILLED and rejects subsequent verification', async () => {
  const { killSession } = await import('../../src/lib/services/terminalAuthService');
  const token = createSessionToken('admin', 7, { ip: '10.0.0.2' });
  const verification = verifySessionToken(token);
  assert.equal(verification.valid, true);
  const sid = verification.sessionId!;

  const killed = killSession(sid, 'admin');
  assert.equal(killed, true);

  // Subsequent verification must be rejected with killed: true
  const verifyAfterKill = verifySessionToken(token);
  assert.equal(verifyAfterKill.valid, false);
  assert.equal(verifyAfterKill.killed, true);
  assert.ok(verifyAfterKill.error?.includes('terminated remotely'));
});

test('AUTH: killAllOtherSessions terminates remote sessions while preserving current session', async () => {
  const { killAllOtherSessions } = await import('../../src/lib/services/terminalAuthService');
  const token1 = createSessionToken('admin', 7, { ip: '192.168.1.1' });
  const token2 = createSessionToken('admin', 7, { ip: '192.168.1.2' });
  const v1 = verifySessionToken(token1);
  const v2 = verifySessionToken(token2);

  const killedCount = killAllOtherSessions(v1.sessionId!, 'admin');
  assert.ok(killedCount >= 1);

  // Current session (token1) is still valid
  const v1After = verifySessionToken(token1);
  assert.equal(v1After.valid, true);

  // Remote session (token2) is now killed
  const v2After = verifySessionToken(token2);
  assert.equal(v2After.valid, false);
  assert.equal(v2After.killed, true);
});
