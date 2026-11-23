import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = process.argv[2];
const manifest = JSON.parse(await readFile(join(directory, 'manifest.json')));
const coverage = JSON.parse(await readFile(join(directory, 'attachments.json')));
assert.equal(manifest.version, 1);
assert.equal(coverage.version, 1);
assert(Array.isArray(manifest.rows) && Array.isArray(coverage.products));
const registry = new Map();
for (const row of manifest.rows) {
  assert(!registry.has(row.id), 'Duplicate media ID');
  registry.set(row.id, row.model);
  for (const kind of ['original','jpeg']) {
    const digest = row[kind + '_sha'];
    assert.match(digest, /^[0-9a-f]{64}$/);
    const bytes = await readFile(join(directory, digest));
    assert.equal(bytes.length, row[kind + '_bytes']);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
  }
}
for (const product of coverage.products) {
  assert(Array.isArray(product.mediaIds));
  for (const id of product.mediaIds) assert.equal(registry.get(id), product.model);
}
console.log('Verified recovered bytes and attachments for', manifest.rows.length, 'media records.');
