import { config } from './config.mjs';
import { sb } from './supabase.mjs';
import { reply, readJson, HttpError } from './http.mjs';
import { permittedStaffRoles, canManageStaff } from './permissions.mjs';
import { authAdmin, invitationState, staffProfile, inviteStaff, updateStaff } from './staff-service.mjs';
import { createRateLimiter } from './rate-limit.mjs';

const writes = createRateLimiter({ limit: 20, windowMs: 3600000 });
async function summary(profile, actor) {
  let user;
  try { user = await authAdmin(`/admin/users/${profile.id}`); }
  catch { return { ...profile, invitation: { status: 'UNKNOWN', expiresAt: null }, authEmail: null, editable: canManageStaff(actor.profile, profile) }; }
  return { ...profile, authEmail: user.email || null, invitation: invitationState(user), editable: canManageStaff(actor.profile, profile) };
}
export async function staffRoutes(req, res, url, actor) {
  const path = url.pathname;
  if (!path.startsWith('/api/admin/staff')) return false;
  if (!['GET', 'HEAD'].includes(req.method) && !writes(actor.user.id)) throw new HttpError(429, 'RATE_LIMITED', 'Too many staff-management attempts. Please wait.');
  if (path === '/api/admin/staff' && req.method === 'GET') {
    const offset = Math.max(0, Math.min(10000, Number.parseInt(url.searchParams.get('offset'), 10) || 0));
    const params = new URLSearchParams({ select: 'id,full_name,notification_email,role,account_state,created_at,last_login_at', order: 'created_at.asc,id.asc', limit: '26', offset: String(offset) });
    const role = url.searchParams.get('role'), state = url.searchParams.get('state');
    if (actor.profile.role === 'ADMIN') params.set('role', 'eq.STAFF');
    else if (['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(role)) params.set('role', `eq.${role}`);
    if (['ACTIVE', 'DISABLED'].includes(state)) params.set('account_state', `eq.${state}`);
    const term = (url.searchParams.get('q') || '').trim().slice(0, 100).replace(/[^\p{L}\p{N} @._+-]/gu, '');
    if (term) params.set('or', `(full_name.ilike.*${term}*,notification_email.ilike.*${term}*)`);
    const rows = await sb(`/rest/v1/profiles?${params}`, { token: actor.session.accessToken });
    const staff = [];
    for (let i = 0; i < Math.min(rows.length, 25); i += 5) staff.push(...await Promise.all(rows.slice(i, Math.min(i + 5, 25)).map((p) => summary(p, actor))));
    reply(res, 200, { staff, offset, hasMore: rows.length > 25, allowedRoles: permittedStaffRoles(actor.profile.role), invitationsEnabled: config.staffInvitationEmailConfigured }); return true;
  }
  const detail = path.match(/^\/api\/admin\/staff\/([0-9a-f-]+)$/i);
  if (detail && req.method === 'GET') {
    const profile = await staffProfile(detail[1], actor.session.accessToken);
    if (actor.profile.role !== 'SUPER_ADMIN' && profile.role !== 'STAFF') throw new HttpError(403, 'FORBIDDEN', 'This account is outside your staff-management permissions.');
    const activityParams = new URLSearchParams({ select: 'id,action,created_at,actor_id,details', or: `(actor_id.eq.${profile.id},and(entity_type.eq.STAFF,entity_id.eq.${profile.id}))`, order: 'created_at.desc', limit: '50' });
    const activity = await sb(`/rest/v1/admin_activity?${activityParams}`, { token: actor.session.accessToken });
    reply(res, 200, { staff: await summary(profile, actor), activity }); return true;
  }
  if (path === '/api/admin/staff/invite' && req.method === 'POST') {
    reply(res, 201, await inviteStaff(actor, await readJson(req, 4096))); return true;
  }
  if (path === '/api/admin/staff/update' && req.method === 'POST') {
    reply(res, 200, await updateStaff(actor, await readJson(req, 4096))); return true;
  }
  reply(res, 404, { error: 'Staff operation not found.' }); return true;
}
