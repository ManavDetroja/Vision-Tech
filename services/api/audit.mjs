import { sb } from './supabase.mjs';

// Callers supply fixed action/permission names, never raw payloads or credentials.
export async function recordStaffEvent(actorId, action, targetId = null, details = {}) {
  await sb('/rest/v1/admin_activity', { service: true, method: 'POST',
    body: { actor_id: actorId, action, entity_type: 'STAFF', entity_id: targetId, details } });
}
export async function recordDenied(actor, permission) {
  try { await recordStaffEvent(actor?.user.id || null, 'PERMISSION_DENIED', null, { permission }); }
  catch { console.error(JSON.stringify({ event: 'permission_audit_unavailable', permission })); }
}
