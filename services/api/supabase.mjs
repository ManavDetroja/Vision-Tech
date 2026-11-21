import { config } from './config.mjs';
import { HttpError } from './http.mjs';

export function supabaseHeaders(apiKey, bearerToken = '', includeLegacyKeyBearer = false) {
  const legacy = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(apiKey);
  const bearer = bearerToken || (includeLegacyKeyBearer && legacy ? apiKey : '');
  return { apikey: apiKey, ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) };
}

export async function sb(path, { method = 'GET', body, token, service = false, headers = {} } = {}) {
  if (service && token) throw new HttpError(500, 'INTERNAL_ERROR', 'Invalid server request.');
  const key = service ? config.secretKey : config.publishableKey;
  let response;
  try {
    response = await fetch(`${config.supabaseUrl}${path}`, {
      method, headers: { ...supabaseHeaders(key, token, true),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(8000), redirect: 'error'
    });
  } catch { throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The service is temporarily unavailable. Please retry later.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (data?.code === 'P0001' && /^Too many submissions\./.test(data.message || '')) {
      throw new HttpError(429, 'RATE_LIMITED', 'Too many submissions. Please try again later.');
    }
    if (data?.code === 'P0001' && data.message === 'Forbidden') {
      throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    }
    throw new HttpError(502, 'DATABASE_UNAVAILABLE', 'The database could not complete the request. Please retry later.');
  }
  return data;
}
