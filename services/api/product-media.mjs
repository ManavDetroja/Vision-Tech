import { createHash } from 'node:crypto';
import { config } from './config.mjs';
import { sb, supabaseHeaders } from './supabase.mjs';
import { HttpError, readJson, reply } from './http.mjs';

export const bucket = 'visiontech-product-media';
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
export const validMediaId = value => typeof value === 'string' && uuid.test(value);
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function storage(method, key, body, type) {
  return fetch(config.supabaseUrl+'/storage/v1/object/'+bucket+'/'+key, {
    method, headers: { ...supabaseHeaders(config.secretKey, '', true),
      ...(body ? { 'Content-Type': type, 'x-upsert':'false' } : {}) },
    body, redirect:'error', signal:AbortSignal.timeout(12000)
  });
}

async function putImmutable(key, bytes, type) {
  const result = await storage('POST', key, bytes, type);
  if(result.ok) return;
  // A retry can find a completed immutable write. Verify the bytes before reuse.
  const previous = await storage('GET', key);
  if(previous.ok && digest(Buffer.from(await previous.arrayBuffer())) === digest(bytes)) return;
  throw new HttpError(503,'STORAGE_UNAVAILABLE','Could not preserve the photograph. Retry the upload.');
}

export async function registerPhoto(model, original, type, jpeg, width, height, actorId) {
  const original_sha = digest(original), jpeg_sha = digest(jpeg);
  await putImmutable(model+'/original/'+original_sha,original,type);
  await putImmutable(model+'/jpeg/'+jpeg_sha,jpeg,'image/jpeg');
  const fields = {model,original_sha,jpeg_sha,original_type:type,original_bytes:original.length,jpeg_bytes:jpeg.length,width,height,uploaded_by:actorId};
  await sb('/rest/v1/product_media?on_conflict=model,original_sha',{service:true,method:'POST',body:fields,
    headers:{Prefer:'resolution=ignore-duplicates,return=minimal'}});
  const [asset] = await sb('/rest/v1/product_media?select=id,approved,uploaded_by&model=eq.'+model+'&original_sha=eq.'+original_sha,{service:true});
  return asset;
}

export async function attachPublishedMedia(records) {
  const permitted = new Set();
  for(let offset=0; ;offset+=100) {
    const ids=await sb('/rest/v1/published_product_media?select=id&order=id&limit=100&offset='+offset);
    for(const row of ids) permitted.add(row.id);
    if(ids.length<100) break;
  }
  return records.map(({record}) => ({...record,publishedMedia:(record.mediaIds||[]).filter(id=>permitted.has(id))}));
}

export async function servePhoto(res, id, manager=false) {
  if(!validMediaId(id)) return reply(res,404,{error:'Image unavailable.'});
  if(!manager) {
    const permitted=await sb('/rest/v1/published_product_media?select=id&id=eq.'+id);
    if(!permitted.length) return reply(res,404,{error:'Image unavailable.'});
  }
  const [row]=await sb('/rest/v1/product_media?select=model,jpeg_sha&id=eq.'+id,{service:true});
  if(!row) return reply(res,404,{error:'Image unavailable.'});
  const result=await storage('GET',row.model+'/jpeg/'+row.jpeg_sha);
  if(!result.ok) throw new HttpError(503,'STORAGE_UNAVAILABLE','Photograph temporarily unavailable.');
  const bytes=Buffer.from(await result.arrayBuffer());
  if(digest(bytes)!==row.jpeg_sha) throw new HttpError(503,'STORAGE_UNAVAILABLE','Photograph integrity check failed.');
  res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  res.end(bytes);
}

export async function reviewPhoto(req,res,id,actor,userRequest) {
  if(actor.profile.role!=='SUPER_ADMIN') return reply(res,403,{error:'A super administrator must review this asset.'});
  const {approved,evidence}=await readJson(req,8192);
  if(!validMediaId(id)||typeof approved!=='boolean'||typeof evidence!=='string'||!evidence.trim()||evidence.length>1000)
    return reply(res,422,{error:'Supply a decision and a rights evidence reference.'});
  const [row]=await userRequest('/rest/v1/product_media?select=uploaded_by&id=eq.'+id);
  if(!row) return reply(res,404,{error:'Unknown asset.'});
  if(approved && row.uploaded_by===actor.user.id) return reply(res,403,{error:'An independent reviewer is required.'});
  await userRequest('/rest/v1/rpc/review_product_media',{method:'POST',body:{p_id:id,p_approved:approved,p_evidence:evidence.trim()}});
  reply(res,200,{approved});
}
