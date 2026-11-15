import { readFile } from 'node:fs/promises';
import { services } from '../js/data/services.js';

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!supabaseUrl || !secretKey) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in the server environment.');

function secretHeaders() {
  const headers = { apikey: secretKey };
  // Legacy service-role JWTs need a role bearer for PostgREST. New sb_secret_ keys
  // are API keys, not JWTs, and must be sent only as `apikey`.
  if (secretKey.startsWith('eyJ')) headers.Authorization = `Bearer ${secretKey}`;
  return headers;
}

async function upsert(table, records, onConflict) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      ...secretHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(records),
    redirect: 'error'
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${table} seed failed (${response.status}): ${message.slice(0, 300)}`);
  }
}

const catalogue = JSON.parse(await readFile(new URL('../js/data/products.json', import.meta.url), 'utf8'));
if (catalogue.length !== 22 || new Set(catalogue.map((item) => item.model)).size !== 22) {
  throw new Error('The current catalogue did not pass the expected 22 unique model check. No data was sent.');
}
const productRows = catalogue.map((record) => ({
  id: record.id,
  model: record.model,
  category_id: record.categoryId,
  record,
  is_visible: true
}));
const serviceRows = services.map((record) => ({ id: record.id, record, is_visible: true }));
await upsert('products', productRows, 'id');
await upsert('service_content', serviceRows, 'id');
console.log(`Seeded ${productRows.length} existing product records and ${serviceRows.length} existing service records. No enquiry records were created.`);
