import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDhanTOTP,
  base32Decode,
  maskCredential,
  DhanAuthService,
} from '../../src/lib/services/dhanAuthService';
import { DhanApiClient } from '../../src/lib/broker/dhan/dhanApiClient';

// =====================================================================
// 1. RFC 6238 TOTP SPECIFICATION VERIFICATION
// =====================================================================
test('TOTP: Base32 decoding correctly converts standard alphabet', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // ASCII: "12345678901234567890"
  const decoded = base32Decode(secret);
  assert.equal(decoded.toString('ascii'), '12345678901234567890');
});

test('TOTP: Base32 decoding handles lowercase, hyphens, and whitespace cleanly', () => {
  const messy = 'gez-dgn-bvgy 3tqo-jqge zdgn-bvgy 3tqo-jq===';
  const decoded = base32Decode(messy);
  assert.equal(decoded.toString('ascii'), '12345678901234567890');
});

test('TOTP: Matches all official RFC 6238 standard test vectors with 100% precision', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  assert.equal(generateDhanTOTP(secret, 59), '287082');
  assert.equal(generateDhanTOTP(secret, 1111111109), '081804');
  assert.equal(generateDhanTOTP(secret, 1111111111), '050471');
  assert.equal(generateDhanTOTP(secret, 1234567890), '005924');
  assert.equal(generateDhanTOTP(secret, 2000000000), '279037');
});

test('TOTP: Generates 6-digit numeric string for dynamic timestamps', () => {
  const secret = 'JBSWY3DPEHPK3PXP'; // "Hello!"
  const otp = generateDhanTOTP(secret);
  assert.equal(otp.length, 6);
  assert.match(otp, /^\d{6}$/);
});

// =====================================================================
// 2. SECURITY & CREDENTIAL MASKING
// =====================================================================
test('SECURITY: maskCredential never reveals middle or full secrets', () => {
  assert.equal(maskCredential('1000123456'), '1000••••3456');
  assert.equal(maskCredential('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'eyJh••••VCJ9');
  assert.equal(maskCredential('short'), '••••••••');
  assert.equal(maskCredential(''), 'Not Configured');
  assert.equal(maskCredential(null), 'Not Configured');
});

test('SECURITY: getAuthStatus does not leak sensitive tokens or secrets to client', async () => {
  const authService = new DhanAuthService();
  await authService.saveToken('SUPER_SECRET_TOKEN_JWT_1234567890', '1000987654');

  const status = await authService.getAuthStatus();
  const serialized = JSON.stringify(status);

  // Assert NO secret data leaks in JSON payload
  assert.ok(!serialized.includes('SUPER_SECRET_TOKEN_JWT_1234567890'));
  assert.ok(serialized.includes('1000••••7654'));
  assert.equal(status.tokenValid, true);
  assert.ok(status.timeRemainingFormatted.includes('h') || status.timeRemainingFormatted.includes('m'));
});

// =====================================================================
// 3. SERVER-SIDE TOKEN CACHING & PRE-EXPIRY RENEWAL
// =====================================================================
test('TOKEN CACHE: Reuses valid in-memory token without invoking external APIs', async () => {
  const authService = new DhanAuthService();
  const futureExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(); // 12 hours remaining

  await authService.saveToken('TOKEN_ABC_VALID', '1000123456', futureExpiry, 'MANUAL');

  const result = await authService.getValidAccessToken();
  assert.equal(result.accessToken, 'TOKEN_ABC_VALID');
  assert.equal(result.clientId, '1000123456');
});

test('TOKEN CACHE: invalidateToken marks token expired for immediate fresh generation', async () => {
  const authService = new DhanAuthService();
  const futureExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

  await authService.saveToken('INITIAL_TOKEN', '1000123456', futureExpiry, 'MANUAL');
  authService.invalidateToken();

  const status = await authService.getAuthStatus();
  assert.equal(status.tokenValid, false);
});

// =====================================================================
// 4. SINGLE-FLIGHT MUTEX LOCK (COALESCING CONCURRENT CALLS)
// =====================================================================
test('SINGLE-FLIGHT: 10 concurrent requests await the exact same token refresh operation', async () => {
  const authService = new DhanAuthService();
  let renewalCount = 0;

  // Mock attemptTokenRenewal to track calls
  authService.attemptTokenRenewal = async (token: string, clientId: string) => {
    renewalCount++;
    await new Promise((r) => setTimeout(r, 50)); // simulate 50ms latency
    return {
      success: true,
      accessToken: 'NEW_RENEWED_TOKEN_999',
      expiryTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    };
  };

  // Seed with expiring token to trigger refresh
  await authService.saveToken('EXPIRING_TOKEN', '1000123456', new Date(Date.now() - 1000).toISOString(), 'MANUAL');

  // Launch 10 simultaneous requests
  const promises = Array.from({ length: 10 }, () =>
    authService.getValidAccessToken({ forceRefresh: true })
  );

  const results = await Promise.all(promises);

  // All 10 requests must receive the exact same renewed token
  for (const res of results) {
    assert.equal(res.accessToken, 'NEW_RENEWED_TOKEN_999');
    assert.equal(res.clientId, '1000123456');
  }

  // Mutex lock ensured only ONE network call occurred!
  assert.equal(renewalCount, 1);
});

// =====================================================================
// 5. DHAN API CLIENT AUTOMATIC 401 RETRY-ONCE RECOVERY
// =====================================================================
test('DHAN API CLIENT: 401 Unauthorized triggers automatic token refresh and single retry', async () => {
  const authService = new DhanAuthService();
  // Seed with token valid in cache (> 5 min buffer), but Dhan server returns 401
  await authService.saveToken('STALE_EXPIRED_TOKEN', '1000123456', new Date(Date.now() + 60 * 60 * 1000).toISOString());

  // Mock refresh to return fresh token
  authService.attemptTokenRenewal = async () => ({
    success: true,
    accessToken: 'FRESH_TOKEN_AFTER_401',
    expiryTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  });

  const client = new DhanApiClient(authService as any);

  // Save original fetch
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  let tokensReceived: string[] = [];

  try {
    // Mock global fetch: returns 401 on first call, 200 OK on retry with new token
    globalThis.fetch = (async (url: any, init: any) => {
      callCount++;
      const authHeader = init?.headers?.get?.('access-token') || (init?.headers && init.headers['access-token']);
      tokensReceived.push(authHeader);

      if (callCount === 1) {
        return new Response(JSON.stringify({ errorCode: 'DH-901', message: 'Token Expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ status: 'success', data: { LTP: 2950.5 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const res = await client.request('/test-endpoint');

    assert.equal(res.ok, true);
    assert.equal(res.retried, true);
    assert.equal(callCount, 2);
    assert.equal(tokensReceived[0], 'STALE_EXPIRED_TOKEN');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
