// Presence and format check only. This script never prints values or makes requests.
const env = process.env;
const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '';
const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
const results = [];

function add(label, ok) {
  results.push({ label, ok: Boolean(ok) });
}

function isLegacyJwt(value) {
  return /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

const url = env.SUPABASE_URL || '';
let validUrl = false;
try {
  const parsed = new URL(url);
  validUrl = ['https:', 'http:'].includes(parsed.protocol) && Boolean(parsed.host) && !url.includes('your-staging-project-ref');
} catch { /* Keep the result boolean; never echo the input. */ }
add('SUPABASE_URL', validUrl);
add('SUPABASE_PUBLISHABLE_KEY', /^(sb_publishable_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.test(publishableKey) && !publishableKey.endsWith('_replace_me'));
add('SUPABASE_SECRET_KEY', /^(sb_secret_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.test(secretKey) && !secretKey.endsWith('_replace_me'));
add('APP_ORIGIN', (() => { try { const parsed = new URL(env.APP_ORIGIN || ''); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.hostname.includes('*'); } catch { return false; } })());
// Opaque server-side sessions no longer need SESSION_ENCRYPTION_KEY.
add('RATE_LIMIT_HASH_SECRET', (env.RATE_LIMIT_HASH_SECRET || '').length >= 32);

for (const result of results) console.log(`${result.label}: ${result.ok ? 'present/valid' : 'missing or invalid'}`);
console.log('Connectivity: not tested; this check made no network requests.');
console.log(`Key formats: publishable=${publishableKey.startsWith('sb_publishable_') ? 'new' : isLegacyJwt(publishableKey) ? 'legacy JWT' : 'unavailable'}; secret=${secretKey.startsWith('sb_secret_') ? 'new' : isLegacyJwt(secretKey) ? 'legacy JWT' : 'unavailable'}`);
if (results.some((result) => !result.ok)) process.exitCode = 1;
