import { randomUUID } from 'node:crypto';
import { config } from './config.mjs';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function reply(res, status, data, headers = {}) {
  const codes = { 400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND',
    413: 'PAYLOAD_TOO_LARGE', 415: 'UNSUPPORTED_MEDIA_TYPE', 422: 'VALIDATION_ERROR',
    429: 'RATE_LIMITED', 500: 'INTERNAL_ERROR', 502: 'DATABASE_UNAVAILABLE', 503: 'UNAVAILABLE' };
  const payload = status >= 400 ? { accepted: false, code: codes[status] || 'REQUEST_FAILED', ...data } : data;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(payload));
}

export function sameOrigin(req) { return req.headers.origin === config.appOrigin; }

export async function readJson(req, max = 32768) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    req.resume();
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send a JSON request.');
  }
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') {
    req.resume();
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Compressed requests are not supported.');
  }
  if (Number(req.headers['content-length']) > max) {
    req.resume();
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request is too large.');
  }
  // Drain oversized requests without destroying the socket before the JSON 413 response.
  const bytes = await new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let rejected = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > max) {
        if (!rejected) reject(new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request is too large.'));
        rejected = true;
        chunks.length = 0;
      } else if (!rejected) chunks.push(chunk);
    });
    req.on('end', () => { if (!rejected) resolve(Buffer.concat(chunks)); });
    req.on('error', () => reject(new HttpError(400, 'BAD_REQUEST', 'Request could not be read.')));
    req.on('aborted', () => reject(new HttpError(400, 'BAD_REQUEST', 'Request was interrupted.')));
  });
  let body;
  try { body = JSON.parse(bytes.toString('utf8')); }
  catch { throw new HttpError(400, 'BAD_REQUEST', 'Request body must be valid JSON.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'BAD_REQUEST', 'Request body must be a JSON object.');
  }
  return body;
}

export function handleError(error, req, res) {
  const known = error instanceof HttpError;
  const status = known ? error.status : 500;
  const requestId = randomUUID();
  // Do not log URLs, bodies, customer data, headers, exception messages or stack traces.
  console.error(JSON.stringify({ event: 'api_request_failed', requestId, status,
    code: known ? error.code : 'INTERNAL_ERROR' }));
  if (!res.headersSent) reply(res, status, { error: known ? error.message : 'The request could not be completed.', requestId });
  else res.destroy();
}
