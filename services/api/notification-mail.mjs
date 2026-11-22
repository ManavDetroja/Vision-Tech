import { createHash } from 'node:crypto';
import { config } from './config.mjs';
import { sb } from './supabase.mjs';
import { HttpError } from './http.mjs';

const service = {service:true};
const read = path => sb('/rest/v1/'+path, service);
const one = async path => (await read(path))[0];
const escape = str => String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const mailbox = value => typeof value==='string' && /^[^\s@,<>;]+@[^\s@,<>;]+\.[^\s@,<>;]+$/.test(value);
const manager = p => ['ADMIN','SUPER_ADMIN'].includes(p.role);
function approvedAddress(profile) {
  const address=profile.notification_email?.trim().toLowerCase();
  const approved=JSON.parse(config.notificationRecipients || '{}');
  return mailbox(address) && approved[profile.id]?.toLowerCase()===address ? address : null;
}
export function template(title, fields, link) {
  const lines=fields.filter(([,value])=>value!==null && value!==undefined && value!=='');
  return {subject:title,
    text:['VisionTech Solutions',title,...lines.map(([label,value])=>label+': '+value),'Open in the private dashboard: '+link].join('\n\n'),
    html:'<div style="font:16px/1.5 Arial,sans-serif;color:#102a56;max-width:580px;border-top:4px solid #155eef;padding:24px"><strong>VisionTech Solutions</strong><h1 style="font-size:24px">'+escape(title)+'</h1>'+
      lines.map(([label,value])=>'<p><strong>'+escape(label)+'</strong><br>'+escape(value)+'</p>').join('')+
      '<p><a style="color:#155eef" href="'+escape(link)+'">Open in the private dashboard</a></p></div>'};
}

async function envelope(job, dashboard) {
  if(job.outbox_id) {
    if(!mailbox(config.enquiryNotificationEmail)) throw new Error('Configuration');
    const box=await one('email_outbox?id=eq.'+job.outbox_id+'&select=enquiry_id,recipient_ids');
    if(!box) return null;
    const enquiry=await one('enquiries?id=eq.'+box.enquiry_id+'&select=enquiry_code,customer_name,enquiry_type,product_model,customer_message');
    if(!enquiry) return null;
    const admins=box.recipient_ids.length ? await read('profiles?account_state=eq.ACTIVE&role=in.(ADMIN,SUPER_ADMIN)&id=in.('+box.recipient_ids.join(',')+')&select=id,notification_email') : [];
    const to=config.enquiryNotificationEmail;
    const bcc=[...new Set(admins.map(approvedAddress).filter(a=>a&&a!==to))].sort();
    return {from:config.emailFrom,to:[to],...(bcc.length?{bcc}:{}),...template('New enquiry '+enquiry.enquiry_code,[
      ['Customer',enquiry.customer_name],['Category',enquiry.enquiry_type],['Product',enquiry.product_model],['Message preview',enquiry.customer_message.slice(0,240)]
    ],new URL('enquiry-details.html?id='+box.enquiry_id,dashboard).href)};
  }
  const n=await one('admin_notifications?id=eq.'+job.notification_id+'&select=recipient_id,enquiry_id,staff_id,kind,title');
  if(!n) return null;
  const p=await one('profiles?id=eq.'+n.recipient_id+'&account_state=eq.ACTIVE&select=id,role,notification_email');
  if(!p) return null;
  const to=approvedAddress(p);
  if(!to) return null;
  let path;
  if(n.enquiry_id) {
    const e=await one('enquiries?id=eq.'+n.enquiry_id+'&select=assigned_to');
    const assignment=['ENQUIRY_ASSIGNED','ENQUIRY_REASSIGNED'].includes(n.kind);
    if(!e || (e.assigned_to!==p.id && (assignment || !manager(p)))) return null;
    path='enquiry-details.html?id='+n.enquiry_id;
  } else if(n.staff_id && manager(p)) {
    const target=await one('profiles?id=eq.'+n.staff_id+'&select=role');
    if(!target || (p.role==='ADMIN' && target.role!=='STAFF')) return null;
    path='staff.html?id='+n.staff_id;
  } else return null;
  return {from:config.emailFrom,to:[to],...template(n.title,[],new URL(path,dashboard).href)};
}

async function update(job,body) {
  const rows=await sb('/rest/v1/notification_delivery?id=eq.'+job.id+'&lease=eq.'+job.lease+'&select=id',{
    service:true,method:'PATCH',headers:{Prefer:'return=representation'},body
  });
  if(rows.length!==1) throw new Error('Delivery lease lost');
}
export async function processDelivery(outboxId=null) {
  const jobs=await sb('/rest/v1/rpc/claim_notification_delivery',{service:true,method:'POST',body:{p_outbox:outboxId}});
  const job=jobs[0];
  if(!job) {
    if(!outboxId) return null;
    const old=await one('email_outbox?id=eq.'+outboxId+'&select=status');
    if(!old) throw new HttpError(404,'NOT_FOUND','Notification record not found.');
    return {accepted:old.status==='SENT'};
  }
  const finish=async(state,reason,providerId=null)=>{
    const delay=Math.min(3600,60*2**Math.min(6,job.attempts-1));
    await update(job,{lease:null,state,last_error:reason,provider_id:providerId,next_attempt:new Date(Date.now()+delay*1000).toISOString()});
    return {accepted:state==='ACCEPTED',state};
  };
  if(job.first_send && Date.now()-Date.parse(job.first_send)>=23*3600000)
    return finish('REVIEW','Provider retry window expired. Reconcile before sending.');
  let payload;
  try {
    const url=new URL(config.adminUrl);
    if(!config.resendKey || !config.emailFrom || url.origin!==config.appOrigin || url.username || url.password ||
      !(url.protocol==='https:' || (url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname)))) throw new Error('Configuration');
    payload=await envelope(job,url);
  } catch {return finish('PENDING','Recipient, provider or dashboard configuration unavailable.');}
  if(!payload) return finish(job.first_send?'REVIEW':'SKIPPED','Recipient or record no longer eligible for this event.');
  const fingerprint=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  if(job.fingerprint && job.fingerprint!==fingerprint) return finish('REVIEW','Message changed after an earlier attempt.');
  await update(job,{first_send:job.first_send || new Date().toISOString(),fingerprint});
  let result;
  try {
    result=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
      headers:{Authorization:'Bearer '+config.resendKey,'Content-Type':'application/json','Idempotency-Key':'visiontech-notification-'+job.id},
      body:JSON.stringify(payload)});
  } catch {return finish('PENDING','Provider connection unconfirmed.');}
  const data=await result.json().catch(()=>null);
  if(result.ok && typeof data?.id==='string' && data.id) return finish('ACCEPTED',null,data.id);
  return finish(result.status===409?'REVIEW':'PENDING','Provider response '+result.status+'; acceptance unconfirmed.');
}
export function startNotificationWorker() {
  let busy=false;
  const tick=async()=>{
    if(busy) return;
    busy=true;
    try {
      await sb('/rest/v1/rpc/enqueue_due_followups',{service:true,method:'POST',body:{}});
      for(let i=0;i<20;i++) if(!await processDelivery()) break;
    } catch { console.error(JSON.stringify({event:'notification_worker_unavailable'})); }
    finally {busy=false;}
  };
  const timer=setInterval(tick,15000);
  timer.unref();
  void tick();
  return ()=>clearInterval(timer);
}
