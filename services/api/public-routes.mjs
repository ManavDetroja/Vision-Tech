import { missingPublicConfig } from './config.mjs';
import { reply, readJson, sameOrigin, HttpError } from './http.mjs';
import { validateEnquiry } from './validation.mjs';
import { createRateLimiter, clientHash } from './rate-limit.mjs';
import { saveEnquiry } from './enquiry-service.mjs';
import { sb } from './supabase.mjs';

const permit = createRateLimiter();
let healthResult; let healthExpires = 0; let healthPending;
async function readiness() {
  if (missingPublicConfig().length) return { ready: false, configured: false, databaseReachable: false };
  if (healthResult && Date.now() < healthExpires) return healthResult;
  if (!healthPending) healthPending = (async () => {
    let databaseReachable = false;
    try { databaseReachable = Array.isArray(await sb('/rest/v1/enquiries?select=id&limit=0', { service: true })); } catch { /* Redacted public status only. */ }
    healthResult = { ready: databaseReachable, configured: true, databaseReachable };
    healthExpires = Date.now() + 10000;
    healthPending = null;
    return healthResult;
  })();
  return healthPending;
}

export async function publicRoutes(req, res, path, { sendOutbox, setEmailStatus }) {
  if (path === '/api/health' && req.method === 'GET') {
    const health = await readiness();
    reply(res, health.ready ? 200 : 503, health);
    return true;
  }
  if (path !== '/api/enquiries' || req.method !== 'POST') return false;
  if (!sameOrigin(req)) throw new HttpError(403, 'FORBIDDEN', 'Request origin is not allowed.');
  if (missingPublicConfig().length) throw new HttpError(503, 'UNAVAILABLE', 'Enquiry submission is not available yet.');
  const rateHash = clientHash(req);
  if (!permit(rateHash)) {
    reply(res, 429, { error: 'Too many requests. Please wait and try again.' }, { 'Retry-After': '60' });
    return true;
  }
  const key = req.headers['idempotency-key'] || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    throw new HttpError(400, 'BAD_REQUEST', 'Refresh the page and try again.');
  }
  const payload = validateEnquiry(await readJson(req));
  if (Array.isArray(payload)) {
    reply(res, 422, { error: payload[0], fields: payload });
    return true;
  }
  const result = await saveEnquiry(payload, key, rateHash);
  if (!result.duplicate && result.emailOutboxId) {
    await sendOutbox(result.emailOutboxId).catch(async () => {
      await setEmailStatus(result.emailOutboxId, 'FAILED', null, 'Notification processing failed after storage.').catch(() => null);
    });
  }
  reply(res, result.duplicate ? 200 : 201, { accepted: true, enquiryId: result.enquiryCode, savedAt: result.createdAt });
  return true;
}
