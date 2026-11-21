import { randomBytes } from 'node:crypto';
import { config } from './config.mjs';
import { HttpError } from './http.mjs';

// Single-process store. Restart fails closed; horizontal scaling needs a shared store.
export function createSessionStore({ now = Date.now, max = 2000 } = {}) {
  const entries = new Map();
  function prune() { for (const [id, v] of entries) if (v.until <= now() || v.idleUntil <= now()) entries.delete(id); }
  return {
    create(data, kind = 'admin') {
      prune();
      if (entries.size >= max) throw new HttpError(503, 'UNAVAILABLE', 'Sign in is temporarily unavailable.');
      const lifetime = kind === 'admin' ? 28800000 : kind === 'request' ? 1800000 : 600000;
      const id = randomBytes(32).toString('base64url');
      entries.set(id, { ...data, kind, until: now() + lifetime, idleUntil: now() + Math.min(lifetime, 1800000) });
      return id;
    },
    get(id, kind = 'admin') {
      prune(); const v = entries.get(id);
      if (!v || v.kind !== kind) return null;
      v.idleUntil = Math.min(v.until, now() + 1800000); return v;
    },
    delete(id) { entries.delete(id); },
    revokeUser(userId) { for (const [id, v] of entries) if (v.userId === userId) entries.delete(id); }
  };
}
export const sessions = createSessionStore();
const names = { admin: 'vt_admin_session', recovery: 'vt_recovery_session', request: 'vt_recovery_request', invite: 'vt_invite_session' };
export function sessionId(req, kind = 'admin') {
  const name = names[kind];
  const values = (req.headers.cookie || '').split(';').map((p) => p.trim()).filter((p) => p.startsWith(`${name}=`));
  if (values.length !== 1) return '';
  const id = values[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(id) ? id : '';
}
export function sessionCookie(id = '', kind = 'admin') {
  const age = !id ? 0 : kind === 'admin' ? 28800 : kind === 'request' ? 1800 : 600;
  return `${names[kind]}=${id}; HttpOnly; Path=/api; SameSite=Strict; Max-Age=${age}${config.production ? '; Secure' : ''}`;
}
