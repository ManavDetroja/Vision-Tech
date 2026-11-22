import test from 'node:test';
import assert from 'node:assert/strict';
import { listEnquiries } from '../api/enquiry-query.mjs';

test('inclusive UTC date bounds and deterministic sorting reach PostgREST before pagination', async () => {
  const input = new URLSearchParams({from:'2024-02-29',to:'2024-02-29',sort:'number',page:'2',pageSize:'10'});
  const result = await listEnquiries(input, async path => {
    const {searchParams} = new URL(path,'http://localhost');
    assert.deepEqual(searchParams.getAll('created_at'), ['gte.2024-02-29T00:00:00.000Z','lt.2024-03-01T00:00:00.000Z']);
    assert.equal(searchParams.get('offset'),'10');
    assert.equal(searchParams.get('limit'),'11');
    assert.equal(searchParams.get('order'),'enquiry_code.asc,id.asc');
    return Array.from({length:11}, (_,i)=>({id:i}));
  });
  assert.equal(result.enquiries.length,10);
  assert.equal(result.hasMore,true);
});

test('unsupported filters are rejected before any database call', async () => {
  for (const input of [{page:'-1'},{sort:'anything'},{to:'2025-02-29'},{assignedTo:'unknown'},{status:'PENDING'},{q:'%'}]) {
    await assert.rejects(listEnquiries(new URLSearchParams(input),()=>assert.fail('Unexpected query')),
      error => error.status === 422);
  }
});
