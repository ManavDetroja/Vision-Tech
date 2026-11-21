// Opt-in disposable Auth fixtures on the confirmed staging project ONLY.
// Random passwords/tokens remain in process memory and are never logged.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { config } from '../api/config.mjs';
import { sb, supabaseHeaders } from '../api/supabase.mjs';
import { sessions } from '../api/session-store.mjs';
import { createApiServer } from '../admin-api.mjs';

const ref = 'fszrsispjxunckknphaw';
assert.equal(process.env.VISIONTECH_AUTH_TEST_APPROVAL, ref, 'Explicit staging test opt-in required');
assert.equal(new URL(config.supabaseUrl).hostname, `${ref}.supabase.co`, 'Wrong target');
assert.equal((await readFile(new URL('../../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim(), ref);
const marker = `vt-auth-${randomUUID()}`;
const password = `Aa9!${randomBytes(24).toString('base64url')}`;
const changedPassword = `Bb8!${randomBytes(24).toString('base64url')}`;
const fixtures = []; let total = 0; let failed = false;
function check(name, condition) { assert.ok(condition, name); total++; console.log(`PASS: ${name}`); }
async function provider(path, method, body) {
  const response = await fetch(`${config.supabaseUrl}/auth/v1${path}`, { method,
    headers: { ...supabaseHeaders(config.secretKey, '', true), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000), redirect: 'error' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Synthetic provider operation failed (${response.status})`);
  return data;
}
const server = createApiServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
config.appOrigin = `http://127.0.0.1:${server.address().port}`;
config.trustedProxy = false;
async function api(path, { body, cookie = '', origin = config.appOrigin, method = body === undefined ? 'GET' : 'POST' } = {}) {
  const response = await fetch(config.appOrigin + path, { method, headers: { Origin: origin,
    ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  const text = JSON.stringify(data);
  assert.ok(!text.includes(config.secretKey) && !text.includes(password) && !text.includes(changedPassword)
    && !/"(?:access_token|refresh_token|accessToken|refreshToken)"/.test(text), 'Secret in API response');
  return { status: response.status, data, cookies: response.headers.getSetCookie(), cookie: response.headers.getSetCookie().find((v) => v.startsWith('vt_admin_session='))?.split(';')[0] || '' };
}
const login = (f, extra = {}) => api('/api/auth/login', { body: { email: f.email, password, ...extra } });
try {
  for (const role of ['ADMIN', 'STAFF']) {
    const email = `${marker}-${role.toLowerCase()}@example.invalid`;
    const created = await provider('/admin/users', 'POST', { email, password, email_confirm: true, user_metadata: { full_name: 'Synthetic Auth Test', role: 'SUPER_ADMIN' } });
    const user = created.user || created;
    assert.ok(user.id); fixtures.push({ id: user.id, email, role });
    const profile = (await sb(`/rest/v1/profiles?id=eq.${user.id}&select=role,account_state`, { service: true }))[0];
    check(`provisioning ${role} ignores forged metadata and defaults disabled STAFF`, profile.role === 'STAFF' && profile.account_state === 'DISABLED');
    await sb(`/rest/v1/profiles?id=eq.${user.id}`, { service: true, method: 'PATCH', body: { role, account_state: 'ACTIVE' } });
  }
  const admin = fixtures[0], staff = fixtures[1];
  let r = await login(admin); let cookie = r.cookie;
  check('valid staging login creates opaque HttpOnly session', r.status === 200 && /^vt_admin_session=[\w-]{43}$/.test(cookie) && r.cookies[0].includes('HttpOnly') && r.cookies[0].includes('SameSite=Strict') && r.cookies[0].includes('Path=/api'));
  check('authoritative ADMIN role returned', r.data.profile.role === 'ADMIN');
  check('session restored on subsequent request', (await api('/api/auth/session', { cookie })).status === 200);
  check('dashboard protected data accessible after login', (await api('/api/admin/overview', { cookie })).status === 200);
  const wrong = await login(admin, { password: `wrong-${randomUUID()}` });
  const missing = await login({ email: `${marker}-missing@example.invalid` });
  check('wrong password and nonexistent account share generic 401', wrong.status === 401 && missing.status === 401 && wrong.data.error === missing.data.error);
  for (const path of ['/api/admin/overview','/api/admin/enquiries','/api/admin/products','/api/admin/staff','/api/admin/services','/api/admin/settings','/api/admin/activity','/api/admin/notifications']) {
    check(`unauthenticated ${path} denied`, (await api(path)).status === 401);
  }
  check('forged browser identity without session denied', (await api('/api/admin/staff/update', { body: { userId: admin.id, role: 'SUPER_ADMIN' } })).status === 401);
  const staffLogin = await login(staff); const staffCookie = staffLogin.cookie;
  check('staff cannot use administrator product route', (await api('/api/admin/products', { cookie: staffCookie })).status === 403);
  check('forged role does not authorize staff mutation', (await api('/api/admin/staff/update', { cookie: staffCookie, body: { userId: admin.id, role: 'SUPER_ADMIN' } })).status === 403);
  check('cross-origin private mutation rejected', (await api('/api/admin/enquiries/10000000-0000-4000-8000-000000000001/status', { method: 'PATCH', cookie, origin: 'https://untrusted.invalid', body: { status: 'CLOSED' } })).status === 403);
  check('cross-origin login rejected', (await api('/api/auth/login', { origin: 'https://untrusted.invalid', body: { email: admin.email, password } })).status === 403);
  const id = cookie.split('=')[1]; const record = sessions.get(id); record.expiresAt = 0;
  const refreshed = await Promise.all([api('/api/auth/session', { cookie }), api('/api/auth/session', { cookie })]);
  check('expired access metadata refreshes through Supabase with concurrent request coalescing', refreshed.every((v) => v.status === 200));
  record.accessToken = 'invalid-test-token';
  check('invalid access token rejected by Supabase', (await api('/api/auth/session', { cookie })).status === 401);
  r = await login(admin); cookie = r.cookie;
  const oldCookie = cookie; r = await login(admin); cookie = r.cookie;
  // Login without sending the old cookie is another device/session; explicit logout tested below.
  check('new login gets a fresh unpredictable ID', oldCookie !== cookie);
  const logout = await api('/api/auth/logout', { method: 'POST', cookie });
  check('logout confirmed and cookie expired', logout.status === 200 && logout.data.signedOut === true && logout.cookies[0].includes('Max-Age=0'));
  check('captured cookie cannot be replayed after logout', (await api('/api/auth/session', { cookie })).status === 401);
  await sb(`/rest/v1/profiles?id=eq.${staff.id}`, { service: true, method: 'PATCH', body: { account_state: 'DISABLED' } });
  check('disabled profile loses an existing session', (await api('/api/auth/session', { cookie: staffCookie })).status === 403);
  check('disabled account cannot log in', (await login(staff)).status === 403);
  const recovery = await provider('/admin/generate_link', 'POST', { type: 'recovery', email: admin.email });
  const tokenHash = recovery.hashed_token || recovery.properties?.hashed_token;
  assert.ok(tokenHash, 'Recovery token was not generated');
  const verified = await api('/api/auth/password-recovery', { body: { tokenHash } });
  const recoveryCookie = verified.cookies.find((v) => v.startsWith('vt_recovery_session='))?.split(';')[0];
  check('genuine staging recovery token exchanged server-side', verified.status === 200 && verified.data.recoveryReady === true && Boolean(recoveryCookie));
  check('recovery-only session cannot access dashboard', (await api('/api/admin/overview', { cookie: recoveryCookie })).status === 401);
  check('used recovery token cannot be replayed', (await api('/api/auth/password-recovery', { body: { tokenHash } })).status === 401);
  check('invalid recovery token rejected', (await api('/api/auth/password-recovery', { body: { tokenHash: 'f'.repeat(64) } })).status === 401);
  check('browser-supplied access token cannot change password', (await api('/api/auth/password-update', { body: { accessToken: 'forged', password: changedPassword } })).status === 401);
  const updated = await api('/api/auth/password-update', { cookie: recoveryCookie, body: { password: changedPassword } });
  check('recovery password update confirmed by Supabase', updated.status === 200 && updated.data.updated === true);
  check('password change invalidates prior application sessions', (await api('/api/auth/session', { cookie: oldCookie })).status === 401);
  check('new password can log in', (await login(admin, { password: changedPassword })).status === 200);
  check('old password rejected', (await login(admin)).status === 401);
} catch (error) {
  failed = true; console.error(`FAIL: ${error.message?.startsWith('Synthetic provider') ? error.message : 'Auth verification stopped; last PASS identifies progress. No raw credentials/errors printed.'}`);
} finally {
  try {
    for (const f of fixtures) {
      const current = await provider(`/admin/users/${f.id}`, 'GET');
      assert.equal((current.user || current).email, f.email, 'Cleanup ownership mismatch');
      await sb(`/rest/v1/admin_activity?actor_id=eq.${f.id}`, { service: true, method: 'DELETE' });
      await provider(`/admin/users/${f.id}`, 'DELETE'); sessions.revokeUser(f.id);
      check('synthetic profile removed by Auth deletion', (await sb(`/rest/v1/profiles?id=eq.${f.id}&select=id`, { service: true })).length === 0);
    }
  } catch { failed = true; console.error('CLEANUP NOT VERIFIED: inspect synthetic Auth fixtures; no broad deletion attempted.'); }
  server.closeAllConnections(); await new Promise((r) => server.close(r));
}
console.log(`Staging Auth checks: ${total}; result: ${failed ? 'FAIL' : 'PASS'}.`);
if (failed) process.exitCode = 1;
