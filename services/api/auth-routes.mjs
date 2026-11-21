import { createHash, createHmac, randomBytes } from 'node:crypto';
import { config } from './config.mjs';
import { roles } from './constants.mjs';
import { reply, readJson, sameOrigin, HttpError } from './http.mjs';
import { createRateLimiter, clientHash } from './rate-limit.mjs';
import { authRequest, tokenPair, verifiedUser, profileFor, actorFor } from './auth.mjs';
import { sessions, sessionId, sessionCookie } from './session-store.mjs';
import { sb } from './supabase.mjs';

const ipPermit = createRateLimiter({ limit: 40, windowMs: 900000 });
const accountPermit = createRateLimiter({ limit: 10, windowMs: 900000 });
const resetPermit = createRateLimiter({ limit: 3, windowMs: 3600000 });
const emailValid = (v) => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
function throttle(req, email, reset = false) {
  const hash = createHmac('sha256', config.rateSecret).update(email || clientHash(req)).digest('hex');
  if (!ipPermit(clientHash(req)) || !(reset ? resetPermit : accountPermit)(hash)) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many attempts. Please wait before trying again.');
  }
}
async function revoke(token, scope = 'local') {
  try { return (await authRequest(`/logout?scope=${scope}`, { method: 'POST', token })).ok; }
  catch { return false; }
}
export async function authRoutes(req, res, path) {
  if (!path.startsWith('/api/auth/')) return false;
  if (!['GET', 'HEAD'].includes(req.method) && !sameOrigin(req)) throw new HttpError(403, 'FORBIDDEN', 'Request origin is not allowed.');
  if (path === '/api/auth/session' && req.method === 'GET') {
    const actor = await actorFor(req, res);
    if (actor) reply(res, 200, { user: { id: actor.user.id, email: actor.user.email }, profile: actor.profile });
    return true;
  }
  if (path === '/api/auth/logout' && req.method === 'POST') {
    const id = sessionId(req); const session = sessions.get(id); sessions.delete(id);
    const providerRevoked = session ? await revoke(session.accessToken) : true;
    reply(res, 200, { signedOut: true, providerRevoked }, { 'Set-Cookie': sessionCookie() }); return true;
  }
  if (path === '/api/auth/login' && req.method === 'POST') {
    const body = await readJson(req, 8192); const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    throttle(req, email);
    if (!emailValid(email) || typeof body.password !== 'string' || !body.password || body.password.length > 256) throw new HttpError(400, 'BAD_REQUEST', 'Enter a valid email and password.');
    const result = await authRequest('/token?grant_type=password', { method: 'POST', body: { email, password: body.password } });
    if (!result.ok) throw new HttpError(result.status >= 500 ? 503 : 401, 'UNAUTHORIZED', result.status >= 500 ? 'Sign in is temporarily unavailable.' : 'Email or password is incorrect.');
    const pair = tokenPair(result.data); const user = await verifiedUser(pair.accessToken); const profile = await profileFor(user.id, pair.accessToken);
    if (user.id !== pair.userId || !profile || profile.account_state !== 'ACTIVE' || !roles.includes(profile.role)) {
      await revoke(pair.accessToken); throw new HttpError(403, 'FORBIDDEN', 'This account is not authorized for the dashboard.');
    }
    await sb('/rest/v1/rpc/record_own_login', { method: 'POST', token: pair.accessToken, body: {} });
    sessions.delete(sessionId(req));
    reply(res, 200, { user: { id: user.id, email: user.email }, profile }, { 'Set-Cookie': sessionCookie(sessions.create(pair)) }); return true;
  }
  if (path === '/api/auth/password-reset' && req.method === 'POST') {
    const body = await readJson(req, 4096); const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    throttle(req, email, true);
    if (!emailValid(email)) throw new HttpError(400, 'BAD_REQUEST', 'Enter a valid email address.');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const redirect = new URL('/admin/reset-password.html', config.appOrigin).href;
    const result = await authRequest(`/recover?redirect_to=${encodeURIComponent(redirect)}`, { method: 'POST',
      body: { email, code_challenge: challenge, code_challenge_method: 's256' } });
    // Provider responses can differ for unknown users / SMTP errors. Do not enumerate.
    if (!result.ok) console.error(JSON.stringify({ event: 'recovery_provider_unconfirmed', status: result.status }));
    sessions.delete(sessionId(req, 'request'));
    reply(res, 202, { accepted: true, message: 'If recovery is available for this address, you will receive reset instructions. Open the link in this browser.' },
      { 'Set-Cookie': sessionCookie(sessions.create({ verifier }, 'request'), 'request') }); return true;
  }
  if (path === '/api/auth/password-recovery' && req.method === 'POST') {
    const body = await readJson(req, 8192); throttle(req, ''); let result;
    if (typeof body.code === 'string' && body.code.length >= 16 && body.code.length <= 4096) {
      const id = sessionId(req, 'request'); const pending = sessions.get(id, 'request'); sessions.delete(id);
      if (!pending) throw new HttpError(401, 'UNAUTHORIZED', 'This reset link expired or belongs to another browser. Request a new email.');
      result = await authRequest('/token?grant_type=pkce', { method: 'POST', body: { auth_code: body.code, code_verifier: pending.verifier } });
    } else if (typeof body.tokenHash === 'string' && /^[a-f0-9]{32,256}$/i.test(body.tokenHash)) {
      result = await authRequest('/verify', { method: 'POST', body: { type: 'recovery', token_hash: body.tokenHash } });
    } else throw new HttpError(401, 'UNAUTHORIZED', 'This reset link is invalid or expired. Request a new reset email.');
    if (!result.ok) throw new HttpError(401, 'UNAUTHORIZED', 'This reset link is invalid or expired. Request a new reset email.');
    const pair = tokenPair(result.data); const user = await verifiedUser(pair.accessToken); const profile = await profileFor(user.id, pair.accessToken);
    if (user.id !== pair.userId || !profile || profile.account_state !== 'ACTIVE' || !roles.includes(profile.role)) {
      await revoke(pair.accessToken); throw new HttpError(403, 'FORBIDDEN', 'This account is not authorized.');
    }
    sessions.delete(sessionId(req, 'recovery'));
    reply(res, 200, { recoveryReady: true }, { 'Set-Cookie': [sessionCookie(sessions.create(pair, 'recovery'), 'recovery'), sessionCookie('', 'request')] }); return true;
  }
  if (path === '/api/auth/password-update' && req.method === 'POST') {
    const id = sessionId(req, 'recovery'); const session = sessions.get(id, 'recovery');
    if (!session || session.expiresAt <= Date.now() / 1000) throw new HttpError(401, 'UNAUTHORIZED', 'This reset link is invalid or expired. Request a new reset email.');
    const body = await readJson(req, 4096);
    if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 256) throw new HttpError(422, 'VALIDATION_ERROR', 'Choose a password between 12 and 256 characters.');
    const user = await verifiedUser(session.accessToken); const profile = await profileFor(user.id, session.accessToken);
    if (user.id !== session.userId || profile?.account_state !== 'ACTIVE') throw new HttpError(403, 'FORBIDDEN', 'This account is not authorized.');
    const result = await authRequest('/user', { method: 'PUT', token: session.accessToken, body: { password: body.password } });
    if (!result.ok) throw new HttpError(422, 'VALIDATION_ERROR', 'The password could not be updated. Use a different strong password or request a new link.');
    sessions.revokeUser(user.id);
    const providerRevoked = await revoke(session.accessToken, 'global');
    reply(res, 200, { updated: true, providerRevoked }, { 'Set-Cookie': [sessionCookie(), sessionCookie('', 'recovery')] }); return true;
  }
  reply(res, 404, { error: 'Not found.' }); return true;
}
