import { config } from './config.mjs';
import { roles } from './constants.mjs';
import { reply, HttpError } from './http.mjs';
import { sb, supabaseHeaders } from './supabase.mjs';
import { sessions, sessionId, sessionCookie } from './session-store.mjs';

export async function authRequest(path, { method = 'GET', body, token } = {}) {
  try {
    const response = await fetch(`${config.supabaseUrl}/auth/v1${path}`, {
      method, headers: { ...supabaseHeaders(config.publishableKey, token), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000), redirect: 'error'
    });
    return { ok: response.ok, status: response.status, data: await response.json().catch(() => null) };
  } catch { throw new HttpError(503, 'UNAVAILABLE', 'Authentication is temporarily unavailable. Try again later.'); }
}
export function tokenPair(data) {
  if (typeof data?.access_token !== 'string' || typeof data?.refresh_token !== 'string' || !data.user?.id) {
    throw new HttpError(502, 'UNAVAILABLE', 'Authentication did not complete. Try again.');
  }
  const expiresAt = Number(data.expires_at || Math.floor(Date.now() / 1000) + Number(data.expires_in));
  if (!Number.isFinite(expiresAt)) throw new HttpError(502, 'UNAVAILABLE', 'Authentication did not complete.');
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt, userId: data.user.id };
}
export async function profileFor(id, token) {
  const query = new URLSearchParams({ select: 'id,full_name,notification_email,role,account_state,created_at,last_login_at', id: `eq.${id}`, limit: '1' });
  return (await sb(`/rest/v1/profiles?${query}`, { token }))?.[0] || null;
}
export async function verifiedUser(token) {
  const result = await authRequest('/user', { token });
  if (result.status >= 500 || result.status === 429) throw new HttpError(503, 'UNAVAILABLE', 'Authentication is temporarily unavailable. Try again later.');
  if (!result.ok || !result.data?.id) throw new HttpError(401, 'UNAUTHORIZED', 'Your session has expired. Sign in again.');
  return result.data;
}
export async function actorFor(req, res, allowed = roles) {
  const id = sessionId(req); const session = sessions.get(id);
  if (!session) { reply(res, 401, { error: 'Sign in to continue.' }, { 'Set-Cookie': sessionCookie() }); return null; }
  try {
    if (session.expiresAt < Date.now() / 1000 + 30) {
      if (!session.refreshing) session.refreshing = (async () => {
        const result = await authRequest('/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refreshToken } });
        if (result.status >= 500 || result.status === 429) throw new HttpError(503, 'UNAVAILABLE', 'Authentication is temporarily unavailable. Try again later.');
        if (!result.ok) throw new HttpError(401, 'UNAUTHORIZED', 'Your session has expired. Sign in again.');
        const pair = tokenPair(result.data);
        if (pair.userId !== session.userId) throw new HttpError(401, 'UNAUTHORIZED', 'Invalid session.');
        Object.assign(session, pair);
      })();
      try { await session.refreshing; } finally { session.refreshing = null; }
    }
    const user = await verifiedUser(session.accessToken);
    if (user.id !== session.userId || !sessions.get(id)) throw new HttpError(401, 'UNAUTHORIZED', 'Sign in again to continue.');
    const profile = await profileFor(user.id, session.accessToken);
    if (!profile || profile.account_state !== 'ACTIVE' || !roles.includes(profile.role)) {
      sessions.delete(id); reply(res, 403, { error: 'This account is disabled or not authorized.' }, { 'Set-Cookie': sessionCookie() }); return null;
    }
    if (!allowed.includes(profile.role)) { reply(res, 403, { error: 'You do not have permission to perform this action.' }); return null; }
    return { session, user, profile };
  } catch (error) {
    if (error.status >= 500) throw error;
    sessions.delete(id);
    reply(res, 401, { error: 'Your session has expired. Sign in again.' }, { 'Set-Cookie': sessionCookie() }); return null;
  }
}
