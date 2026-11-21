import { authRequest, verifiedUser, profileFor, tokenPair } from './auth.mjs';
import { authAdmin, invitationState } from './staff-service.mjs';
import { recordStaffEvent } from './audit.mjs';
import { readJson, reply, HttpError, sameOrigin } from './http.mjs';
import { sessions, sessionId, sessionCookie } from './session-store.mjs';
import { createRateLimiter, clientHash } from './rate-limit.mjs';

const attempts = createRateLimiter({ limit: 20, windowMs: 900000 });
const invalid = () => new HttpError(401, 'INVALID_INVITATION', 'This invitation is invalid, expired or already completed. Contact your administrator.');
async function eligible(token) {
  const user = await verifiedUser(token), profile = await profileFor(user.id, token);
  const state = invitationState(user);
  if (!['PENDING', 'VERIFIED'].includes(state.status) || !Number.isFinite(Date.parse(state.expiresAt))) throw invalid();
  if (!profile || profile.account_state !== 'ACTIVE' || !['ADMIN', 'STAFF'].includes(profile.role)) throw new HttpError(403, 'FORBIDDEN', 'This invitation is not authorized. Contact your administrator.');
  return { user, profile };
}
export async function invitationRoutes(req, res, path) {
  if (!['/api/auth/invitation-verify', '/api/auth/invitation-complete'].includes(path)) return false;
  if (req.method !== 'POST') { reply(res, 405, { error: 'Use POST.' }); return true; }
  if (!sameOrigin(req)) throw new HttpError(403, 'FORBIDDEN', 'Request origin is not allowed.');
  if (!attempts(clientHash(req))) throw new HttpError(429, 'RATE_LIMITED', 'Too many invitation attempts. Please wait.');
  if (path.endsWith('invitation-verify')) {
    const body = await readJson(req, 4096);
    if (typeof body.tokenHash !== 'string' || !/^[a-f0-9]{32,256}$/i.test(body.tokenHash)) throw invalid();
    const result = await authRequest('/verify', { method: 'POST', body: { type: 'invite', token_hash: body.tokenHash } });
    if (!result.ok) throw invalid();
    const pair = tokenPair(result.data);
    const { user } = await eligible(pair.accessToken);
    if (user.id !== pair.userId) throw invalid();
    sessions.delete(sessionId(req, 'invite'));
    reply(res, 200, { invitationReady: true }, { 'Set-Cookie': sessionCookie(sessions.create(pair, 'invite'), 'invite') }); return true;
  }
  const id = sessionId(req, 'invite'), session = sessions.get(id, 'invite');
  if (!session || session.expiresAt <= Date.now() / 1000) throw invalid();
  const body = await readJson(req, 4096);
  if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 256) throw new HttpError(422, 'VALIDATION_ERROR', 'Choose a password between 12 and 256 characters.');
  const { user } = await eligible(session.accessToken);
  if (user.id !== session.userId) throw invalid();
  await recordStaffEvent(user.id, 'STAFF_INVITATION_COMPLETION_REQUESTED', user.id);
  const result = await authRequest('/user', { method: 'PUT', token: session.accessToken, body: { password: body.password } });
  if (!result.ok) throw new HttpError(422, 'VALIDATION_ERROR', 'Password setup was not confirmed. Try a different strong password.');
  // Revoke before follow-up bookkeeping; a provider/account error cannot leave
  // this setup session reusable. Existing audit history is append-only here.
  sessions.revokeUser(user.id);
  await authAdmin(`/admin/users/${user.id}`, { method: 'PUT', body: { app_metadata: { ...user.app_metadata,
    visiontech_invitation: { ...user.app_metadata.visiontech_invitation, completed_at: new Date().toISOString() }
  } } });
  await recordStaffEvent(user.id, 'STAFF_INVITATION_COMPLETED', user.id);
  let providerRevoked = false;
  try { providerRevoked = (await authRequest('/logout?scope=global', { method: 'POST', token: session.accessToken })).ok; } catch { /* App session is already revoked. */ }
  reply(res, 200, { completed: true, providerRevoked }, { 'Set-Cookie': [sessionCookie('', 'invite'), sessionCookie()] }); return true;
}
