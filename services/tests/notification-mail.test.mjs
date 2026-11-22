import test from 'node:test';
import assert from 'node:assert/strict';
import { template, processDelivery } from '../api/notification-mail.mjs';
import { config } from '../api/config.mjs';

test('notification templates escape HTML while preserving readable plain text and optional fields', () => {
  const content=template('A & B',[['Name','<example>'],['Product',null]],'https://example.invalid/admin/');
  assert.match(content.html,/A &amp; B/);
  assert.match(content.html,/&lt;example&gt;/);
  assert(!content.html.includes('<example>'));
  assert(!content.text.includes('Product'));
  assert(content.text.includes('Name: <example>'));
});

test('expired ambiguous provider attempt enters review without another provider call',async () => {
  const original=globalThis.fetch;
  const oldUrl=config.supabaseUrl;
  config.supabaseUrl='http://127.0.0.1:1';
  const calls=[];
  globalThis.fetch=async(url,options)=>{
    assert.equal(new URL(url).hostname,'127.0.0.1');
    calls.push(JSON.parse(options.body));
    if(calls.length===1) return Response.json([{id:'fixture',lease:'lease',attempts:2,first_send:'2000-01-01T00:00:00Z'}]);
    return Response.json([{id:'fixture'}]);
  };
  try {
    assert.deepEqual(await processDelivery(),{accepted:false,state:'REVIEW'});
    assert.equal(calls.length,2);
    assert.equal(calls[1].lease,null);
    assert.equal(calls[1].state,'REVIEW');
  } finally {
    config.supabaseUrl=oldUrl;
    globalThis.fetch=original;
  }
});
