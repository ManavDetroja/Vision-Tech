import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request } from 'node:http';

Object.assign(process.env, { SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_unit_test', SUPABASE_SECRET_KEY: 'sb_secret_unit_test',
  APP_ORIGIN: 'http://127.0.0.1:5500', SESSION_ENCRYPTION_KEY: 'a'.repeat(64),
  RATE_LIMIT_HASH_SECRET: 'unit-test-only-'.repeat(4) });
const { createApiServer, supabaseHeaders, validateEnquiry } = await import('../admin-api.mjs');
const { config } = await import('../api/config.mjs');
const { createRateLimiter } = await import('../api/rate-limit.mjs');
const realFetch = globalThis.fetch;
const server = createApiServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let mode = 'success'; let calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  if (mode === 'offline') throw new Error('private database password MUST_NOT_LEAK');
  if (mode === 'rate') return Response.json({ code: 'P0001', message: 'Too many submissions. Please try again later.' }, { status: 400 });
  if (mode === 'database') return Response.json({ code: 'XX000', message: 'SQL SECRET MUST_NOT_LEAK' }, { status: 500 });
  if (mode === 'unconfirmed') return Response.json({ accepted: true });
  if (url.includes('limit=0')) return Response.json([]);
  return Response.json({ accepted: true, duplicate: mode === 'duplicate', enquiryCode: 'VT-TEST-000001', createdAt: '2026-11-16T00:00:00Z' });
};
const payload = { name: ' Test Customer ', email: 'TEST@EXAMPLE.INVALID', phone: '+91 (90000) 00000',
  enquiryType: 'general', message: 'Synthetic test enquiry, please ignore.', consent: true, website: '' };
async function send(body = payload, headers = {}) {
  const r = await realFetch(`${base}/api/enquiries`, { method: 'POST', headers: {
    Origin: config.appOrigin, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
}
try {
  await test('new keys never used as bearer; user bearer remains separate; legacy supported', () => {
    assert.deepEqual(supabaseHeaders('sb_secret_test', '', true), { apikey: 'sb_secret_test' });
    assert.deepEqual(supabaseHeaders('sb_publishable_test', 'user-jwt', true), { apikey: 'sb_publishable_test', Authorization: 'Bearer user-jwt' });
    assert.equal(supabaseHeaders('eyJa.e30.fake', '', true).Authorization, 'Bearer eyJa.e30.fake');
  });
  await test('valid enquiry normalized and saved only after acknowledgement', async () => {
    const r = await send(); assert.equal(r.status, 201); assert.equal(r.data.accepted, true);
    const upstream = calls.at(-1); const body = JSON.parse(upstream.options.body);
    assert.equal(body.p_payload.phone, '+919000000000'); assert.equal(body.p_payload.email, 'test@example.invalid');
    assert.equal(upstream.options.headers.Authorization, undefined);
    assert.equal(upstream.options.headers.apikey, config.secretKey);
  });
  await test('optional email supported in validator', () => assert.equal(validateEnquiry({ ...payload, email: '' }).email, ''));
  await test('duplicate database acknowledgement returns same ID without a second success creation', async () => {
    mode = 'duplicate'; const r = await send(); assert.equal(r.status, 200); assert.equal(r.data.enquiryId, 'VT-TEST-000001'); mode = 'success';
  });
  await test('missing fields, invalid email/phone and non-text values rejected', async () => {
    for (const body of [{}, { ...payload, email: 'bad' }, { ...payload, phone: '123bad' }, { ...payload, name: {} }]) {
      const n = calls.length; const r = await send(body); assert.equal(r.status, 422); assert.equal(calls.length, n);
    }
  });
  await test('malformed and non-object JSON rejected', async () => {
    for (const body of ['{', 'null', '[]']) assert.equal((await send(body)).status, 400);
  });
  await test('unsupported content type and oversized body rejected', async () => {
    assert.equal((await send(payload, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await send('x'.repeat(40000))).status, 413);
  });
  await test('chunked oversized request returns JSON 413 rather than resetting connection', async () => {
    const result = await new Promise((resolve, reject) => {
      const req = request(`${base}/api/enquiries`, { method: 'POST', headers: { Origin: config.appOrigin,
        'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() } }, (res) => {
        let text = ''; res.on('data', (b) => { text += b; }); res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(text) }));
      });
      req.on('error', reject); req.write('x'.repeat(20000)); req.end('x'.repeat(20000));
    });
    assert.equal(result.status, 413); assert.equal(result.data.code, 'PAYLOAD_TOO_LARGE');
  });
  await test('XSS markup rejected; SQL-looking text remains bound JSON data', async () => {
    assert.equal((await send({ ...payload, message: '<script>alert(1)</script> test enquiry' })).status, 422);
    const attack = "Customer's query: '; DROP TABLE public.enquiries; --";
    assert.equal((await send({ ...payload, message: attack })).status, 201);
    assert.equal(JSON.parse(calls.at(-1).options.body).p_payload.message, attack);
  });
  await test('disallowed origin and unauthenticated private route protected', async () => {
    assert.equal((await send(payload, { Origin: 'https://untrusted.invalid' })).status, 403);
    const r = await realFetch(`${base}/api/admin/enquiries`); assert.equal(r.status, 401);
  });
  await test('invalid idempotency UUID rejected', async () => assert.equal((await send(payload, { 'Idempotency-Key': '-'.repeat(36) })).status, 400));
  await test('database failures are 502 without SQL or secrets', async () => {
    mode = 'database'; const r = await send(); assert.equal(r.status, 502); assert.doesNotMatch(JSON.stringify(r), /MUST_NOT_LEAK|sb_secret|SQL SECRET/); mode = 'success';
  });
  // A new trusted address keeps subsequent failure tests separate from the earlier request budget.
  config.trustedProxy = true;
  await test('unconfirmed database result never returns success', async () => {
    mode = 'unconfirmed'; const r = await send(payload, { 'X-Forwarded-For': '192.0.2.1' }); assert.equal(r.status, 502); mode = 'success';
  });
  await test('upstream network failure returns safe 503', async () => {
    mode = 'offline'; const r = await send(payload, { 'X-Forwarded-For': '192.0.2.1' }); assert.equal(r.status, 503); assert.doesNotMatch(JSON.stringify(r), /MUST_NOT_LEAK/); mode = 'success';
  });
  await test('persistent database limiter maps to HTTP 429', async () => {
    mode = 'rate'; const r = await send(payload, { 'X-Forwarded-For': '192.0.2.1' }); assert.equal(r.status, 429); mode = 'success';
  });
  await test('HTTP limiter rejects repeated malformed submissions before database access', async () => {
    let r; const n = calls.length;
    for (let i = 0; i < 21; i++) r = await send({}, { 'X-Forwarded-For': '192.0.2.2' });
    assert.equal(r.status, 429); assert.equal(calls.length, n);
  });
  await test('bounded limiter expires entries and does not grow without bound', () => {
    let now = 0; const permit = createRateLimiter({ limit: 1, windowMs: 10, maxEntries: 1, now: () => now });
    assert.equal(permit('a'), true); assert.equal(permit('a'), false); assert.equal(permit('b'), false);
    now = 11; assert.equal(permit('b'), true);
  });
  await test('health verifies connectivity without configuration disclosure', async () => {
    let r = await realFetch(`${base}/api/health`); assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ready: true, configured: true, databaseReachable: true });
    const saved = config.secretKey; config.secretKey = '';
    r = await realFetch(`${base}/api/health`); assert.equal(r.status, 503); config.secretKey = saved;
  });
} finally {
  globalThis.fetch = realFetch;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
