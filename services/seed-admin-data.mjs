import { readFile } from 'node:fs/promises';
import { services } from '../js/data/services.js';

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!supabaseUrl || !serviceKey) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment.');

async function upsert(table, records, onConflict) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
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