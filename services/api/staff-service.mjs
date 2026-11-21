import { randomUUID } from 'node:crypto';
import { config } from './config.mjs';
import { sb, supabaseHeaders } from './supabase.mjs';
import { HttpError } from './http.mjs';
import { canManageStaff, permittedStaffRoles } from './permissions.mjs';
import { recordStaffEvent } from './audit.mjs';
import { sessions } from './session-store.mjs';

export const uuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const emailValid = (v) => typeof v === 'string' && v.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(v);
const forbidden = () => new HttpError(403, 'FORBIDDEN', 'You do not have permission to manage this account or role.');
export async function authAdmin(path, { method = 'GET', body } = {}) {
  let r;
  try {
    r = await fetch(`${config.supabaseUrl}/auth/v1${path}`, { method,
      headers: { ...supabaseHeaders(config.secretKey, '', true), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(8000) });
  } catch { throw new HttpError(503, 'UNAVAILABLE', 'The account service is unavailable. Check the staff directory before retrying.'); }
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new HttpError(r.status === 422 ? 409 : 502, 'ACCOUNT_SERVICE_ERROR', 'The account service did not confirm this operation. Check existing accounts and email configuration before retrying.');
  return data?.user || data;
}
export function invitationState(user) {
  const invitation = user?.app_metadata?.visiontech_invitation;
  if (!invitation) return { status: user?.invited_at ? 'UNTRACKED' : 'NOT_INVITED', expiresAt: null };
  if (!Number.isFinite(Date.parse(invitation.expires_at))) return { status: 'UNKNOWN', expiresAt: null };
  if (invitation.completed_at) return { status: 'COMPLETED', expiresAt: invitation.expires_at };
  if (Date.parse(invitation.expires_at) <= Date.now()) return { status: 'EXPIRED', expiresAt: invitation.expires_at };
  return { status: user.email_confirmed_at ? 'VERIFIED' : 'PENDING', expiresAt: invitation.expires_at };
}
export async function staffProfile(id, token) {
  if (!uuid(id)) throw new HttpError(422, 'VALIDATION_ERROR', 'Choose a valid staff account.');
  const rows = await sb(`/rest/v1/profiles?id=eq.${id}&select=id,full_name,notification_email,role,account_state,created_at,last_login_at`, { token });
  if (!rows?.[0]) throw new HttpError(404, 'NOT_FOUND', 'Staff account not found.');
  return rows[0];
}
export function staffInput(body) {
  if (typeof body.fullName !== 'string' || typeof body.email !== 'string') throw new HttpError(422, 'VALIDATION_ERROR', 'Enter a valid name and email.');
  const fullName = body.fullName.trim(), email = body.email.trim().toLowerCase();
  if (fullName.length < 2 || fullName.length > 100 || /[<>\x00-\x1f]/.test(fullName) || !emailValid(email)) throw new HttpError(422, 'VALIDATION_ERROR', 'Enter a valid name and email.');
  if (!['STAFF', 'ADMIN'].includes(body.role)) throw forbidden();
  return { fullName, email, role: body.role };
}
export async function updateStaff(actor, body) {
  const values = staffInput(body);
  const target = await staffProfile(body.userId, actor.session.accessToken);
  if (!canManageStaff(actor.profile, target, values.role)) throw forbidden();
  if (!['ACTIVE', 'DISABLED'].includes(body.accountState) || body.confirm !== true) throw new HttpError(422, 'VALIDATION_ERROR', 'Confirm the account changes and choose a valid status.');
  await recordStaffEvent(actor.user.id, 'STAFF_UPDATE_REQUESTED', target.id, { previousRole: target.role, previousState: target.account_state, role: values.role, state: body.accountState });
  // Existing service-only RPC repeats authoritative actor/target restrictions and
  // records STAFF_SETTINGS_CHANGED in the same database transaction as the update.
  await sb('/rest/v1/rpc/admin_set_staff', { service: true, method: 'POST', body: {
    p_actor: actor.user.id, p_target: target.id, p_role: values.role, p_state: body.accountState, p_name: values.fullName, p_email: values.email
  } });
  sessions.revokeUser(target.id);
  return { updated: true };
}
const pendingEmails = new Set();
async function emailExists(email) {
  // Auth email is authoritative; notification_email is independently editable.
  // Fail closed if a bounded scan cannot prove absence.
  for (let page = 1; page <= 100; page++) {
    const result = await authAdmin(`/admin/users?page=${page}&per_page=100`);
    if (!Array.isArray(result?.users)) throw new HttpError(502, 'UNAVAILABLE', 'Existing accounts could not be verified.');
    if (result.users.some((u) => u.email?.toLowerCase() === email)) return true;
    if (result.users.length < 100) return false;
  }
  throw new HttpError(503, 'UNAVAILABLE', 'The account directory requires administrator review before another invitation.');
}
export async function inviteStaff(actor, body) {
  const values = staffInput(body);
  if (!permittedStaffRoles(actor.profile.role).includes(values.role)) throw forbidden();
  if (body.confirm !== true) throw new HttpError(422, 'VALIDATION_ERROR', 'Confirm the staff invitation.');
  if (!config.staffInvitationEmailConfigured) throw new HttpError(503, 'INVITATION_NOT_CONFIGURED', 'Invitation email and redirect configuration must be verified before sending invitations.');
  if (pendingEmails.has(values.email)) throw new HttpError(409, 'CONFLICT', 'An invitation for this address is already being processed.');
  pendingEmails.add(values.email);
  try {
    if (await emailExists(values.email)) throw new HttpError(409, 'CONFLICT', 'An account already exists. Review its details; an invitation will not change its role.');
    await recordStaffEvent(actor.user.id, 'STAFF_INVITE_REQUESTED', null, { role: values.role });
    const nonce = randomUUID();
    const redirect = new URL('/admin/accept-invitation.html', config.appOrigin).href;
    const user = await authAdmin(`/invite?redirect_to=${encodeURIComponent(redirect)}`, { method: 'POST', body: { email: values.email, data: { full_name: values.fullName, visiontech_invite_nonce: nonce } } });
    // Supabase can re-invite an existing unconfirmed user. Such users retain their
    // original metadata; never assign privileges unless this request created them.
    if (!uuid(user?.id) || user.email?.toLowerCase() !== values.email || user.user_metadata?.visiontech_invite_nonce !== nonce) throw new HttpError(409, 'CONFLICT', 'Account identity changed during invitation. No role was assigned; administrator review is required.');
    await authAdmin(`/admin/users/${user.id}`, { method: 'PUT', body: { app_metadata: { ...user.app_metadata,
      visiontech_invitation: { requested_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString(), completed_at: null }
    } } });
    await sb('/rest/v1/rpc/admin_set_staff', { service: true, method: 'POST', body: {
      p_actor: actor.user.id, p_target: user.id, p_role: values.role, p_state: 'ACTIVE', p_name: values.fullName, p_email: values.email
    } });
    await recordStaffEvent(actor.user.id, 'STAFF_INVITATION_SENT', user.id, { role: values.role });
    return { invited: true, userId: user.id, message: 'Supabase accepted the invitation email request. Delivery is not yet confirmed.' };
  } catch (error) {
    // There is no transaction spanning Auth email, profile RPC and audit writes.
    // Leave partial accounts for review; never delete users or retry elevation.
    try { await recordStaffEvent(actor.user.id, 'STAFF_INVITATION_INCOMPLETE', null, { code: error.code || 'UNAVAILABLE' }); } catch { /* Safe structured API error remains visible. */ }
    throw error;
  } finally { pendingEmails.delete(values.email); }
}
