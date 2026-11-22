import { config } from './config.mjs';
import { HttpError } from './http.mjs';

export function supabaseHeaders(apiKey, bearerToken = '', includeLegacyKeyBearer = false) {
  const legacy = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(apiKey);
  const bearer = bearerToken || (includeLegacyKeyBearer && legacy ? apiKey : '');
  return { apikey: apiKey, ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) };
}

export async function sb(path, { method = 'GET', body, token, service = false, headers = {}, exactCount = false } = {}) {
  if (service && token) throw new HttpError(500, 'INTERNAL_ERROR', 'Invalid server request.');
  const key = service ? config.secretKey : config.publishableKey;
  let response;
  try {
    response = await fetch(`${config.supabaseUrl}${path}`, {
      method: exactCount ? 'HEAD' : method, headers: { ...supabaseHeaders(key, token, true),
        ...(exactCount ? { Prefer: 'count=exact' } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(8000), redirect: 'error'
    });
  } catch { throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The service is temporarily unavailable. Please retry later.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (data?.code === 'P0001' && data.message === 'Notification not found') {
      throw new HttpError(404, 'NOT_FOUND', 'Notification not found.');
    }
    if (data?.code === 'P0001' && data.message === 'Assignee is not active') {
      throw new HttpError(422, 'VALIDATION_ERROR', 'Choose an active staff account.');
    }
    if (data?.code === 'P0001' && data.message === 'Enquiry not found') {
      throw new HttpError(404, 'NOT_FOUND', 'Enquiry not found or access denied.');
    }
    if (data?.code === 'P0001' && /^Too many submissions\./.test(data.message || '')) {
      throw new HttpError(429, 'RATE_LIMITED', 'Too many submissions. Please try again later.');
    }
    if (data?.code === 'P0001' && data.message === 'Forbidden') {
      throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    }
    throw new HttpError(502, 'DATABASE_UNAVAILABLE', 'The database could not complete the request. Please retry later.');
  }
  if (exactCount) {
    const total = response.headers.get('Content-Range')?.match(/\/(\d+)$/)?.[1];
    if (!total || !Number.isSafeInteger(Number(total))) {
      throw new HttpError(502, 'DATABASE_UNAVAILABLE', 'The database could not confirm a record count.');
    }
    return Number(total);
  }
  return data;
}
