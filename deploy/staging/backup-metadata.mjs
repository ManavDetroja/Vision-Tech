import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { sb } from '../../services/api/supabase.mjs';
import { config } from '../../services/api/config.mjs';

assert.equal(config.supabaseUrl, 'https://fszrsispjxunckknphaw.supabase.co');
const directory = process.argv[2];
const manifest = JSON.parse(await readFile(join(directory, 'manifest.json')));
const registry = new Map(manifest.rows.map(row => [row.id, row]));
const products = [];
for (let offset = 0;; offset += 100) {
  const batch = await sb('/rest/v1/products?select=id,model,is_visible,updated_at,record&order=id&limit=100&offset=' + offset, { service: true });
  for (const row of batch) {
    const mediaIds = row.record.mediaIds || [];
    for (const id of mediaIds) assert.equal(registry.get(id)?.model, row.model, 'Inconsistent registry snapshot');
    products.push({ id: row.id, model: row.model, visible: row.is_visible, version: row.updated_at, mediaIds });
  }
  if (batch.length < 100) break;
}
await writeFile(join(directory, 'attachments.json'), JSON.stringify({ version: 1, products }), { flag: 'wx', mode: 0o600 });
