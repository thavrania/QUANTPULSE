import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionToken,
  verifySessionToken,
  verifyTerminalCredentials,
  getConfiguredUsername,
} from '../../src/lib/services/terminalAuthService';

test('AUTH: verifyTerminalCredentials succeeds with valid master password', async () => {
  const result = await verifyTerminalCredentials('admin', 'Quant@0033.');
  assert.equal(result.valid, true);
  assert.equal(result.username, 'admin');
});

test('AUTH: verifyTerminalCredentials supports common aliases case-insensitively', async () => {
  const res1 = await verifyTerminalCredentials('Admin', 'Quant@0033.');
  assert.equal(res1.valid, true);

  const res2 = await verifyTerminalCredentials('QuantPulse', 'Quant@0033.');
  assert.equal(res2.valid, true);

  const res3 = await verifyTerminalCredentials('trader', 'Quant@0033.');
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
