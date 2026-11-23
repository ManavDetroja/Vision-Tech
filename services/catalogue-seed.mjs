import { readFile } from 'node:fs/promises';
import { categories } from '../js/data/categories.js';

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

export async function insertMissing(table, records, onConflict) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      ...secretHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal'
    },
    body: JSON.stringify(records),
    redirect: 'error'
  });
  if (!response.ok) {
    throw new Error(table+' seed failed with HTTP '+response.status);
  }
}

export async function seedProducts() {
  const catalogue=JSON.parse(await readFile(new URL('../js/data/products.json',import.meta.url),'utf8'));
  const expected=new Set(['CP-UNC-DA21L3C-Q','CP-UNC-DA21L3B-LQ','CP-UNC-DA61L3C-LQ','CP-UNC-TA21L3C-Q','CP-UNC-TA21L3B-LQ','CP-UNC-TA41L3C-D-Q2','CP-UNC-TA61L3C-LQ','CP-E21Q','CP-E31Q','EZ-M32T','EZ-R33T','EZ-S35T','CP-SL06K','CP-UNR-104F1','CP-UNR-4K2081-V4','CP-UNR-4K2162-V3','CP-UNR-4K4322-V4','CP-ANW-HP4H2-N65','CP-ANW-HPU8H2-N12']);
  const rows=catalogue.map(product=>{
    const category=categories.find(c=>c.id===product.categoryId);
    if(!expected.delete(product.model)||product.id!==product.model.toLowerCase()||!category||
       (product.subcategory && !category.subcategories.includes(product.subcategory))) throw new Error('Unexpected catalogue identity or taxonomy.');
    const record=Object.fromEntries(Object.entries(product).filter(([key])=>!/^image|^gallery|^mediaIds$|^publishedMedia$/.test(key)));
    return {id:record.id,model:record.model,category_id:record.categoryId,record,is_visible:true};
  });
  if(expected.size) throw new Error('Baseline catalogue incomplete.');
  await insertMissing('products',rows,'id');
}
