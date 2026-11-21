import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageStaff, routePermission, permittedStaffRoles } from '../api/permissions.mjs';
import { invitationState, staffInput, inviteStaff } from '../api/staff-service.mjs';
import { config } from '../api/config.mjs';
test('permission matrix prevents self edits and protects every Super Admin', () => {
  for (const role of ['SUPER_ADMIN', 'ADMIN', 'STAFF']) {
    const actor = { id: 'actor', role };
    assert.equal(canManageStaff(actor, actor, 'STAFF'), false);
    assert.equal(canManageStaff(actor, { id: 'other', role: 'SUPER_ADMIN' }, 'STAFF'), false);
    assert.equal(permittedStaffRoles(role).includes('SUPER_ADMIN'), false);
  }
  assert.equal(canManageStaff({ id: 'a', role: 'ADMIN' }, { id: 'b', role: 'ADMIN' }, 'STAFF'), false);
  assert.equal(canManageStaff({ id: 'a', role: 'SUPER_ADMIN' }, { id: 'b', role: 'ADMIN' }, 'STAFF'), true);
});
test('central private route matrix limits operational and business-wide features', () => {
  for (const route of ['/api/admin/staff/invite','/api/admin/products','/api/admin/services','/api/admin/enquiries/id/assign','/api/admin/assignees']) assert.equal(routePermission(route,'POST').roles.includes('STAFF'),false);
  assert.deepEqual(routePermission('/api/admin/settings','GET').roles,['SUPER_ADMIN']);
  assert.deepEqual(routePermission('/api/admin/enquiries/id','DELETE').roles,['SUPER_ADMIN']);
  assert.ok(routePermission('/api/admin/enquiries/id/notes','POST').roles.includes('STAFF'));
});
test('invitation status distinguishes missing, malformed, completed and expired state', () => {
  assert.equal(invitationState({}).status,'NOT_INVITED');
  assert.equal(invitationState({invited_at:'2026-01-01'}).status,'UNTRACKED');
  const state=(v)=>invitationState({app_metadata:{visiontech_invitation:v}}).status;
  assert.equal(state({expires_at:'invalid'}),'UNKNOWN');
  assert.equal(state({expires_at:'2000-01-01'}),'EXPIRED');
  assert.equal(state({expires_at:'2000-01-01',completed_at:'2000-01-01'}),'COMPLETED');
  assert.equal(state({expires_at:new Date(Date.now()+60000).toISOString()}),'PENDING');
});
test('typed staff inputs reject markup, objects and privileged role requests', () => {
  for (const body of [{fullName:{},email:'x@example.invalid',role:'STAFF'},{fullName:'<script>',email:'x@example.invalid',role:'STAFF'},{fullName:'Employee',email:'x@example.invalid',role:'SUPER_ADMIN'}]) assert.throws(()=>staffInput(body));
  assert.deepEqual(staffInput({fullName:' Employee ',email:' PERSON@EXAMPLE.INVALID ',role:'STAFF'}),{fullName:'Employee',email:'person@example.invalid',role:'STAFF'});
});
test('unconfigured invitation delivery stops before Auth access', async () => {
  const before=config.staffInvitationEmailConfigured;config.staffInvitationEmailConfigured=false;
  try { await assert.rejects(inviteStaff({profile:{role:'SUPER_ADMIN'}},{fullName:'Employee',email:'employee@example.invalid',role:'STAFF',confirm:true}),e=>e.status===503&&e.code==='INVITATION_NOT_CONFIGURED'); }
  finally {config.staffInvitationEmailConfigured=before;}
});
