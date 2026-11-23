import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { productManagement } from '../api/product-management.mjs';

const record = {
  categoryId: 'ip-cameras', subcategory: 'Dome Cameras', featured: false,
  features: [], specifications: {}, galleryPaths: [], resolutionMp: null
};

function save(body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = 'POST';
  req.headers = { 'content-type': 'application/json' };
  return productManagement(req, {}, '/api/admin/products', assert.fail);
}

for (const model of ['CP-Z42Q', 'CP-UNC-DA41L3C-Q2', 'CP-DNW-HPU8G2-6-V3']) {
  test('rejects excluded model '+ model, async () => {
    await assert.rejects(save({model, isVisible: true, record}), /eligible exact model/);
  });
}

for (const [name, change, reason] of [
  ['mismatched category', {subcategory:'Solar Panel Kits'}, /subcategory/],
  ['unsourced specifications', {specifications:{channels:'4'}}, /official exact-model source/],
  ['external image', {galleryPaths:['https://example.invalid/photo.jpg']}, /Image does not belong/],
  ['unsourced features', {features:['Fixture feature']}, /official source/],
  ['invalid resolution', {resolutionMp:-2}, /resolution/]
]) {
  test(name+' is rejected before the write', async () => {
    await assert.rejects(save({model:'VT-TEST',isVisible:false,record:{...record,...change}}), reason);
  });
}
