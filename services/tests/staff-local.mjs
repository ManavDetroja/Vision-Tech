// Explicit LOCAL-only integration runner. Never loads the project's .env.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { config } from '../api/config.mjs';
import { sb, supabaseHeaders } from '../api/supabase.mjs';
import { authAdmin } from '../api/staff-service.mjs';
import { createApiServer } from '../admin-api.mjs';

const workdir=process.env.VISIONTECH_LOCAL_WORKDIR, cli=process.env.VISIONTECH_LOCAL_CLI;
assert.ok(workdir && cli, 'Set explicit disposable LOCAL workdir and CLI executable');
const local=JSON.parse(execFileSync(cli,['status','--workdir',workdir,'--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(new URL(local.API_URL).hostname,'127.0.0.1','LOCAL only');
assert.equal(new URL(local.DB_URL).hostname,'127.0.0.1','LOCAL database only');
Object.assign(config,{supabaseUrl:local.API_URL,publishableKey:local.PUBLISHABLE_KEY||local.ANON_KEY,secretKey:local.SECRET_KEY||local.SERVICE_ROLE_KEY,rateSecret:randomBytes(32).toString('hex'),trustedProxy:false,staffInvitationEmailConfigured:true,resendKey:''});
const marker=`vt-staff7-${randomUUID()}`, password=`Aa9!${randomBytes(24).toString('base64url')}`;
const users=[], enquiries=[]; let passed=0, failed=false;
const check=(name,value)=>{assert.ok(value,name);passed++;console.log(`PASS: ${name}`);};
const server=createApiServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));config.appOrigin=`http://127.0.0.1:${server.address().port}`;
async function api(path,{body,cookie='',method=body===undefined?'GET':'POST',origin=config.appOrigin}={}) {
 const r=await fetch(config.appOrigin+path,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();assert.ok(!JSON.stringify(data).includes(config.secretKey));assert.ok(!/"(?:access_token|refresh_token|hashed_token)"/.test(JSON.stringify(data)));
 return {status:r.status,data,cookies:r.headers.getSetCookie(),cookie:r.headers.getSetCookie().find(c=>c.startsWith('vt_admin_session='))?.split(';')[0]};
}
const login=(user)=>api('/api/auth/login',{body:{email:user.email,password}});
const change=(actor,target,role,state='ACTIVE',extra={})=>api('/api/admin/staff/update',{cookie:actor.cookie,body:{userId:target.id,fullName:'Synthetic Employee',email:target.email,role,accountState:state,confirm:true,...extra}});
try {
 for(const role of ['SUPER_ADMIN','ADMIN','STAFF','STAFF']) {
  const user=await authAdmin('/admin/users',{method:'POST',body:{email:`${marker}-${users.length}@example.invalid`,password,email_confirm:true}});users.push(user);
  await sb(`/rest/v1/profiles?id=eq.${user.id}`,{service:true,method:'PATCH',body:{role,account_state:'ACTIVE'}});
  user.role=role;user.cookie=(await login(user)).cookie;assert.ok(user.cookie);
 }
 const [superadmin,admin,staff,other]=users;
 check('SUPER_ADMIN directory includes all test roles',(await api('/api/admin/staff',{cookie:superadmin.cookie})).data.staff.some(u=>u.role==='SUPER_ADMIN'));
 check('ADMIN directory contains STAFF only',(await api('/api/admin/staff',{cookie:admin.cookie})).data.staff.every(u=>u.role==='STAFF'));
 check('STAFF direct directory access denied',(await api('/api/admin/staff',{cookie:staff.cookie})).status===403);
 check('anonymous private API denied',(await api('/api/admin/staff')).status===401);
 check('ADMIN cannot read SUPER_ADMIN details',(await api(`/api/admin/staff/${superadmin.id}`,{cookie:admin.cookie})).status===403);
 check('ADMIN cannot promote STAFF',(await change(admin,staff,'ADMIN')).status===403);
 check('ordinary endpoint cannot grant SUPER_ADMIN',(await change(superadmin,staff,'SUPER_ADMIN')).status===403);
 check('self change denied',(await change(admin,admin,'STAFF')).status===403);
 check('last SUPER_ADMIN cannot be disabled or demoted',(await change(superadmin,superadmin,'STAFF','DISABLED')).status===403);
 check('explicit confirmation required',(await change(admin,staff,'STAFF','ACTIVE',{confirm:false})).status===422);
 check('CSRF on staff changes denied',(await api('/api/admin/staff/update',{cookie:admin.cookie,body:{},origin:'https://untrusted.invalid'})).status===403);
 check('ADMIN can deactivate STAFF',(await change(admin,staff,'STAFF','DISABLED')).status===200);
 check('deactivation revokes existing app session',(await api('/api/auth/session',{cookie:staff.cookie})).status===401);
 check('disabled account cannot log in',(await login(staff)).status===403);
 check('ADMIN can reactivate STAFF',(await change(admin,staff,'STAFF')).status===200);
 staff.cookie=(await login(staff)).cookie;
 check('SUPER_ADMIN can grant ADMIN',(await change(superadmin,other,'ADMIN')).status===200);
 check('ADMIN cannot edit another ADMIN',(await change(admin,other,'STAFF')).status===403);
 const raw=await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:{...supabaseHeaders(config.publishableKey),'Content-Type':'application/json'},body:JSON.stringify({email:staff.email,password})});
 const tokens=await raw.json();assert.ok(tokens.access_token);
 const direct=await fetch(`${config.supabaseUrl}/rest/v1/profiles?id=eq.${staff.id}`,{method:'PATCH',headers:{...supabaseHeaders(config.publishableKey,tokens.access_token),'Content-Type':'application/json'},body:JSON.stringify({role:'SUPER_ADMIN'})});
 check('direct PostgREST self-promotion blocked',direct.status===401||direct.status===403);
 for(const target of [staff,admin]) {
  const id=randomUUID();enquiries.push(id);
  await sb('/rest/v1/enquiries',{service:true,method:'POST',body:{id,enquiry_code:`TEST-${id}`,idempotency_key:randomUUID(),customer_name:'Synthetic Staff RLS',customer_email:'fixture@example.invalid',customer_phone:'0000000000',enquiry_type:'GENERAL_ENQUIRY',customer_message:'Disposable local permission test',consented_at:new Date().toISOString(),assigned_to:target.id}});
 }
 check('STAFF can read assigned enquiry',(await api(`/api/admin/enquiries/${enquiries[0]}`,{cookie:staff.cookie})).status===200);
 check('STAFF cannot read unassigned enquiry',(await api(`/api/admin/enquiries/${enquiries[1]}`,{cookie:staff.cookie})).status===404);
 check('STAFF can update assigned status',(await api(`/api/admin/enquiries/${enquiries[0]}/status`,{cookie:staff.cookie,method:'PATCH',body:{status:'CONTACTED'}})).status===200);
 check('STAFF cannot update another enquiry',(await api(`/api/admin/enquiries/${enquiries[1]}/status`,{cookie:staff.cookie,method:'PATCH',body:{status:'CONTACTED'}})).status===403);
 check('STAFF can add assigned internal note',(await api(`/api/admin/enquiries/${enquiries[0]}/notes`,{cookie:staff.cookie,body:{note:'Synthetic authorized note'}})).status===201);
 check('STAFF cannot assign work',(await api(`/api/admin/enquiries/${enquiries[0]}/assign`,{cookie:staff.cookie,method:'PATCH',body:{assignee:staff.id}})).status===403);
 check('STAFF cannot access product management',(await api('/api/admin/products',{cookie:staff.cookie})).status===403);
 check('ADMIN cannot read business settings',(await api('/api/admin/settings',{cookie:admin.cookie})).status===403);
 check('SUPER_ADMIN can read business settings',(await api('/api/admin/settings',{cookie:superadmin.cookie})).status===200);
 const invitation={fullName:'Synthetic Invitee',email:`${marker}-invite@example.invalid`,role:'STAFF',confirm:true};
 check('ADMIN cannot invite ADMIN',(await api('/api/admin/staff/invite',{cookie:admin.cookie,body:{...invitation,role:'ADMIN'}})).status===403);
 check('STAFF cannot invite users',(await api('/api/admin/staff/invite',{cookie:staff.cookie,body:invitation})).status===403);
 const invited=await api('/api/admin/staff/invite',{cookie:admin.cookie,body:invitation});
 if(invited.data.userId)users.push({id:invited.data.userId,email:invitation.email});
 check('ADMIN STAFF invitation acknowledged by local Auth',invited.status===201&&invited.data.invited===true);
 check('existing account cannot be reinvited or role overwritten',(await api('/api/admin/staff/invite',{cookie:superadmin.cookie,body:{...invitation,role:'ADMIN'}})).status===409);
 const mailUrl=local.MAILPIT_URL||local.INBUCKET_URL;assert.ok(mailUrl,'Local mailbox URL absent');
 const inbox=await (await fetch(`${mailUrl}/api/v1/messages`)).json();
 const msg=inbox.messages.find(m=>(m.To||[]).some(t=>t.Address===invitation.email));assert.ok(msg,'Invitation email absent');
 const mail=await (await fetch(`${mailUrl}/api/v1/message/${msg.ID}`)).json();
 const link=(mail.HTML||'').match(/https?:[^"\s<>]+[?&]token=[^"\s<>]+/i)?.[0]?.replaceAll('&amp;','&');
 const hash=link?new URL(link).searchParams.get('token'):null;assert.ok(hash,'Expected official invite token absent');
 check('local SMTP sink received invitation',true);
 const verify=await api('/api/auth/invitation-verify',{body:{tokenHash:hash}});
 const invitationCookie=verify.cookies.find(c=>c.startsWith('vt_invite_session='))?.split(';')[0];
 check('genuine invitation verified without exposing tokens',verify.status===200&&!!invitationCookie);
 check('invitation session cannot access private dashboard',(await api('/api/admin/overview',{cookie:invitationCookie})).status===401);
 check('invitation token replay rejected',(await api('/api/auth/invitation-verify',{body:{tokenHash:hash}})).status===401);
 check('invalid invitation rejected',(await api('/api/auth/invitation-verify',{body:{tokenHash:'f'.repeat(64)}})).status===401);
 check('invitation completes password setup',(await api('/api/auth/invitation-complete',{cookie:invitationCookie,body:{password}})).status===200);
 const invitee=users.at(-1);
 check('invited employee can sign in',(await login(invitee)).status===200);
 check('completed invitation status reported',(await api(`/api/admin/staff/${invitee.id}`,{cookie:admin.cookie})).data.staff.invitation.status==='COMPLETED');
 const events=await sb(`/rest/v1/admin_activity?actor_id=eq.${admin.id}&select=action`,{service:true});
 check('role/state changes retain audit history',events.some(e=>e.action==='STAFF_SETTINGS_CHANGED'));
 check('permission failures recorded',events.some(e=>e.action==='PERMISSION_DENIED'));
 check('staff invitation recorded',events.some(e=>e.action==='STAFF_INVITATION_SENT'));
 // Prove expiry check independently of provider OTP lifetime, without waiting.
 const expiredUser=await authAdmin('/admin/users',{method:'POST',body:{email:`${marker}-expired@example.invalid`,email_confirm:true,password}});users.push(expiredUser);
 await sb(`/rest/v1/profiles?id=eq.${expiredUser.id}`,{service:true,method:'PATCH',body:{account_state:'ACTIVE'}});
 await authAdmin(`/admin/users/${expiredUser.id}`,{method:'PUT',body:{app_metadata:{visiontech_invitation:{expires_at:'2000-01-01T00:00:00Z',completed_at:null}}}});
 const expiredTokens=await (await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:{...supabaseHeaders(config.publishableKey),'Content-Type':'application/json'},body:JSON.stringify({email:expiredUser.email,password})})).json();
 const {sessions}=await import('../api/session-store.mjs');
 const expiredId=sessions.create({accessToken:expiredTokens.access_token,expiresAt:Date.now()/1000+300,userId:expiredUser.id},'invite');
 check('expired invitation cannot complete setup',(await api('/api/auth/invitation-complete',{cookie:`vt_invite_session=${expiredId}`,body:{password}})).status===401);
 await fetch(`${mailUrl}/api/v1/messages`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({IDs:[msg.ID]})});
} catch(error) {failed=true;console.error('FAIL:',error instanceof assert.AssertionError?error.message:'Local integration operation failed; no raw provider data printed.');}
finally {
 try {
  for(const id of enquiries) {await sb(`/rest/v1/admin_activity?entity_id=eq.${id}`,{service:true,method:'DELETE'});await sb(`/rest/v1/enquiries?id=eq.${id}`,{service:true,method:'DELETE'});}
  // Recover only test-owned invite accounts after a partial response or failure.
  const listing=await authAdmin('/admin/users?page=1&per_page=1000');
  for(const u of listing.users||[]) if(u.email?.startsWith(marker)&&!users.some(v=>v.id===u.id))users.push(u);
  for(const user of users) {
   const actual=await authAdmin(`/admin/users/${user.id}`);assert.ok(actual.email.startsWith(marker));
   await sb(`/rest/v1/admin_activity?or=(actor_id.eq.${user.id},entity_id.eq.${user.id})`,{service:true,method:'DELETE'});
   await authAdmin(`/admin/users/${user.id}`,{method:'DELETE'});
  }
  const remaining=await authAdmin('/admin/users?page=1&per_page=1000');
  check('all owned local synthetic users cleaned',!remaining.users.some(u=>u.email?.startsWith(marker)));
 } catch {failed=true;console.error('CLEANUP UNVERIFIED: inspect only vt-staff7 fixtures.');}
 server.closeAllConnections();await new Promise(r=>server.close(r));
}
console.log(`Local staff checks: ${passed}; ${failed?'FAIL':'PASS'}`);if(failed)process.exitCode=1;
