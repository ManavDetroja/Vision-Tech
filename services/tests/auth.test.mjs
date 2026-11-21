import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
Object.assign(process.env, { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test', APP_ORIGIN: 'http://127.0.0.1:5500', RATE_LIMIT_HASH_SECRET: 'test-'.repeat(10) });
const { createApiServer } = await import('../admin-api.mjs');
const { config } = await import('../api/config.mjs');
const { createSessionStore, sessions, sessionCookie } = await import('../api/session-store.mjs');
const realFetch = globalThis.fetch; let mode = ''; let requests = [];
const pair = { access_token: 'unit-access-token', refresh_token: 'unit-refresh-token', expires_in: 3600, user: { id: 'unit-user', email: 'test@example.invalid' } };
globalThis.fetch = async (url, options) => {
  requests.push({ url, options });
  if (mode === 'offline') throw new Error('PRIVATE ERROR');
  if (mode === 'provider-500') return Response.json({}, { status: 500 });
  if (url.includes('/logout')) return new Response(null, { status: mode === 'logout-failed' ? 500 : 204 });
  if (url.includes('/recover?')) return Response.json({}, { status: mode === 'smtp-failed' ? 500 : 200 });
  if (url.includes('/token?grant_type=refresh_token') && mode === 'expired-refresh') return Response.json({}, { status: 400 });
  if (url.includes('/token?') || url.endsWith('/verify')) return Response.json(pair);
  if (url.endsWith('/user')) return Response.json(pair.user);
  if (url.includes('/profiles?')) return Response.json([{ id: 'unit-user', role: 'ADMIN', account_state: 'ACTIVE' }]);
  return Response.json({});
};
const server = createApiServer(); await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const password = randomBytes(24).toString('base64url');
async function api(path, body, cookie = '', origin = config.appOrigin) {
  const r = await realFetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin,
    ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, data: await r.json(), cookies: r.headers.getSetCookie() };
}
try {
  await test('opaque store enforces idle expiry, absolute expiry and capacity', () => {
    let now = 0; const store = createSessionStore({ now: () => now, max: 1 });
    const id = store.create({ userId: 'a' }); assert.throws(() => store.create({}), /temporarily/);
    now = 1800001; assert.equal(store.get(id), null);
    const next = store.create({ userId: 'b' });
    for (let i = 0; i < 15; i++) { now += 1700000; assert.ok(store.get(next)); }
    now += 4000000; assert.equal(store.get(next), null);
  });
  await test('recovery session expires after ten minutes and cannot be an admin session', () => {
    let now = 0; const store = createSessionStore({ now: () => now }); const id = store.create({}, 'recovery');
    assert.equal(store.get(id), null); assert.ok(store.get(id, 'recovery')); now = 600001; assert.equal(store.get(id, 'recovery'), null);
  });
  await test('production cookie is Secure HttpOnly SameSite and bounded', () => {
    config.production = true; const c = sessionCookie('test'); assert.match(c, /; Secure/); assert.match(c, /HttpOnly; Path=\/api; SameSite=Strict; Max-Age=28800/);
    config.production = false; assert.doesNotMatch(sessionCookie('test'), /; Secure/);
  });
  await test('legacy encrypted and arbitrary bearer cookies fail closed', async () => {
    assert.equal((await api('/api/auth/session', undefined, 'vt_admin_session=legacy-encrypted-token')).status, 401);
  });
  let cookie;
  await test('login rotates an existing browser session and exposes no tokens', async () => {
    const first = await api('/api/auth/login', { email: 'test@example.invalid', password }); cookie = first.cookies[0].split(';')[0];
    const second = await api('/api/auth/login', { email: 'test@example.invalid', password }, cookie);
    assert.equal(second.status, 200); assert.notEqual(second.cookies[0].split(';')[0], cookie);
    assert.equal((await api('/api/auth/session', undefined, cookie)).status, 401);
    cookie = second.cookies[0].split(';')[0]; assert.doesNotMatch(JSON.stringify(second), /unit-access-token|unit-refresh-token|sb_secret_test/);
  });
  await test('missing or incorrect origin prevents auth writes', async () => {
    assert.equal((await api('/api/auth/logout', {}, cookie, '')).status, 403);
    assert.equal((await api('/api/auth/logout', {}, cookie, 'https://evil.invalid')).status, 403);
  });
  await test('provider outage does not masquerade as invalid credentials', async () => {
    mode = 'offline'; assert.equal((await api('/api/auth/session', undefined, cookie)).status, 503); mode = '';
    assert.equal((await api('/api/auth/session', undefined, cookie)).status, 200);
    mode = 'provider-500'; assert.equal((await api('/api/auth/session', undefined, cookie)).status, 503);
    sessions.get(cookie.split('=')[1]).expiresAt = 0;
    assert.equal((await api('/api/auth/session', undefined, cookie)).status, 503); mode = '';
    assert.equal((await api('/api/auth/session', undefined, cookie)).status, 200);
  });
  await test('invalid refresh token invalidates server session', async () => {
    sessions.get(cookie.split('=')[1]).expiresAt = 0; mode = 'expired-refresh';
    assert.equal((await api('/api/auth/session', undefined, cookie)).status, 401); mode = '';
  });
  await test('provider logout failure still invalidates app cookie and is reported honestly', async () => {
    const login = await api('/api/auth/login', { email: 'test@example.invalid', password }); cookie = login.cookies[0].split(';')[0];
    mode = 'logout-failed'; const r = await api('/api/auth/logout', {}, cookie); mode = '';
    assert.equal(r.data.signedOut, true); assert.equal(r.data.providerRevoked, false);
    assert.equal((await api('/api/auth/session', undefined, cookie)).status, 401);
  });
  let pending;
  await test('reset request is uniform despite provider response and uses PKCE', async () => {
    const good = await api('/api/auth/password-reset', { email: 'one@example.invalid' });
    mode = 'smtp-failed'; const bad = await api('/api/auth/password-reset', { email: 'two@example.invalid' }); mode = '';
    assert.equal(good.status, 202); assert.deepEqual(good.data, bad.data); pending = good.cookies[0].split(';')[0];
    const body = JSON.parse(requests.find((r) => r.url.includes('/recover?')).options.body);
    assert.equal(body.code_challenge_method, 's256'); assert.equal(body.code_challenge.length, 43);
  });
  await test('PKCE exchange requires originating browser cookie', async () => {
    assert.equal((await api('/api/auth/password-recovery', { code: 'a'.repeat(30) })).status, 401);
    const result = await api('/api/auth/password-recovery', { code: 'a'.repeat(30) }, pending);
    assert.equal(result.status, 200); assert.equal(result.data.recoveryReady, true);
    assert.equal((await api('/api/auth/password-recovery', { code: 'a'.repeat(30) }, pending)).status, 401);
  });
  await test('expired recovery session and browser access-token substitution rejected', async () => {
    const id = sessions.create({ ...pair, expiresAt: 0 }, 'recovery');
    assert.equal((await api('/api/auth/password-update', { password }, `vt_recovery_session=${id}`)).status, 401);
    assert.equal((await api('/api/auth/password-update', { password, accessToken: 'unit-access-token' })).status, 401);
  });
  await test('login throttles repeated attempts independently of supplied roles', async () => {
    let r; for (let i = 0; i < 11; i++) r = await api('/api/auth/login', { email: 'rate@example.invalid', password, role: 'SUPER_ADMIN' });
    assert.equal(r.status, 429);
  });
} finally {
  globalThis.fetch = realFetch; server.closeAllConnections(); await new Promise((r) => server.close(r));
}
