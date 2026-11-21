// Explicit opt-in: synthetic enquiries ONLY on the owner-confirmed staging reference.
// Loads credentials through node --env-file; never prints them. No schema deployment.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createApiServer } from '../admin-api.mjs';
import { config } from '../api/config.mjs';
import { sb } from '../api/supabase.mjs';

const ref = 'fszrsispjxunckknphaw';
assert.equal(process.env.VISIONTECH_STAGING_TEST_APPROVAL, ref, 'Explicit staging test opt-in required.');
assert.equal(new URL(config.supabaseUrl).hostname, `${ref}.supabase.co`, 'Wrong target; stopped.');
assert.equal((await readFile(new URL('../../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim(), ref, 'Wrong linked project; stopped.');
// Process-only test overrides. Never send email or reuse a customer's rate bucket.
config.resendKey = ''; config.rateSecret = randomBytes(32).toString('hex'); config.trustedProxy = false;
const server = createApiServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
config.appOrigin = `http://127.0.0.1:${server.address().port}`;
const keys = Array.from({ length: 6 }, () => randomUUID());
const marker = `VT-SYNTHETIC-${randomUUID()}`;
const checks = [];
function check(name, ok) { assert.ok(ok, name); checks.push(name); console.log(`PASS: ${name}`); }
async function post(payload, key) {
  const response = await fetch(`${config.appOrigin}/api/enquiries`, { method: 'POST',
    headers: { Origin: config.appOrigin, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload) });
  const data = await response.json();
  check('response contains no credentials', !JSON.stringify(data).includes(config.secretKey) && !JSON.stringify(data).includes(config.publishableKey));
  return { status: response.status, data };
}
const base = { name: 'Synthetic Staging Test', email: 'visiontech-test@example.invalid', phone: '+919000000000',
  enquiryType: 'product', productModel: 'CP-UNC-DA21L3C-Q', serviceRequirement: '',
  message: `${marker}: Customer's query '; DROP TABLE public.enquiries; -- is plain text.`, consent: true, website: '' };
const keyFilter = `idempotency_key=in.(${keys.join(',')})`;
let failed = false;
try {
  const health = await fetch(`${config.appOrigin}/api/health`);
  check('health verifies actual staging connectivity', health.status === 200 && (await health.json()).databaseReachable === true);
  const first = await post(base, keys[0]); check('valid enquiry persisted', first.status === 201 && first.data.accepted === true);
  const duplicate = await post(base, keys[0]); check('retry returns same ID', duplicate.status === 200 && duplicate.data.enquiryId === first.data.enquiryId);
  const rows = await sb(`/rest/v1/enquiries?${keyFilter}&select=id,customer_name,customer_email,customer_phone,product_model,customer_message,status`, { service: true });
  check('exact customer fields and SQL-looking message stored as data', rows.length === 1 && rows[0].customer_name === base.name
    && rows[0].customer_email === base.email && rows[0].customer_phone === base.phone && rows[0].product_model === base.productModel
    && rows[0].customer_message === base.message && rows[0].status === 'NEW');
  const outbox = await sb(`/rest/v1/email_outbox?enquiry_id=eq.${rows[0].id}&select=status`, { service: true });
  check('unconfigured email retained enquiry and recorded FAILED outbox', outbox.length === 1 && outbox[0].status === 'FAILED');
  for (let i = 1; i < 5; i++) check(`legitimate submission ${i + 1}`, (await post({ ...base, message: `${marker}: Synthetic rate-limit check ${i}.` }, keys[i])).status === 201);
  check('sixth distinct submission rejected by persistent database limiter', (await post(base, keys[5])).status === 429);
  const publicResponse = await fetch(`${config.supabaseUrl}/rest/v1/enquiries?select=id&limit=1`, { headers: { apikey: config.publishableKey } });
  check('anonymous Data API cannot read enquiries', [401, 403].includes(publicResponse.status));
} catch {
  failed = true; console.error('FAIL: staging test failed; see the last completed check. No raw upstream data printed.');
} finally {
  try {
    // Delete only IDs selected by this run's random idempotency keys and synthetic marker.
    const rows = await sb(`/rest/v1/enquiries?${keyFilter}&select=id,customer_message`, { service: true });
    assert.ok(rows.every((row) => row.customer_message.startsWith(marker)), 'Cleanup ownership check failed.');
    if (rows.length) {
      const ids = rows.map((row) => row.id).join(',');
      await sb(`/rest/v1/admin_notifications?enquiry_id=in.(${ids})`, { service: true, method: 'DELETE' });
      await sb(`/rest/v1/admin_activity?entity_type=eq.ENQUIRY&entity_id=in.(${ids})`, { service: true, method: 'DELETE' });
      await sb(`/rest/v1/enquiries?id=in.(${ids})`, { service: true, method: 'DELETE' });
      check('synthetic outbox cascade cleanup', (await sb(`/rest/v1/email_outbox?enquiry_id=in.(${ids})&select=id`, { service: true })).length === 0);
      check('synthetic activity and notification cleanup', (await sb(`/rest/v1/admin_activity?entity_type=eq.ENQUIRY&entity_id=in.(${ids})&select=id`, { service: true })).length === 0
        && (await sb(`/rest/v1/admin_notifications?enquiry_id=in.(${ids})&select=id`, { service: true })).length === 0);
    }
    const hash = createHmac('sha256', config.rateSecret).update('127.0.0.1').digest('hex');
    await sb(`/rest/v1/submission_rate_limits?bucket_key=eq.${hash}`, { service: true, method: 'DELETE' });
    check('synthetic enquiries and rate bucket removed', (await sb(`/rest/v1/enquiries?${keyFilter}&select=id`, { service: true })).length === 0
      && (await sb(`/rest/v1/submission_rate_limits?bucket_key=eq.${hash}&select=bucket_key`, { service: true })).length === 0);
  } catch { failed = true; console.error('CLEANUP NOT VERIFIED: retain this run for inspection; no broad deletion attempted.'); }
  server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
}
console.log(`Staging checks completed: ${checks.length}; result: ${failed ? 'FAIL' : 'PASS'}.`);
if (failed) process.exitCode = 1;
