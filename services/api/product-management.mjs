import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { categories } from '../../js/data/categories.js';
import { registerPhoto, reviewPhoto, servePhoto, validMediaId } from './product-media.mjs';
import { HttpError, readJson, reply } from './http.mjs';

const excluded=new Set(['CP-Z42Q','CP-UNC-DA41L3C-Q2','CP-DNW-HPU8G2-6-V3']);
function invalid(message){throw new HttpError(422,'VALIDATION_ERROR',message);}
function plain(value,max){
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) invalid('Invalid text or field length.');
  return value.trim();
}
function modelCode(value){
  if(typeof value!=='string'||!/^[A-Z0-9][A-Z0-9-]{0,99}$/.test(value)||excluded.has(value)) invalid('Choose an eligible exact model code.');
  return value;
}
function decodePhoto(bytes,format){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.env.VISIONTECH_PYTHON || 'python',['-I',fileURLToPath(new URL('./product-photo.py',import.meta.url)),format],{stdio:['pipe','pipe','ignore'],windowsHide:true,timeout:12000});
    const chunks=[];
    child.stdout.on('data',chunk=>chunks.push(chunk));
    child.on('error',()=>reject(new HttpError(503,'UNAVAILABLE','Image processor unavailable.')));
    child.stdin.on('error',()=>{});
    child.on('close',code=>code===0?resolve(Buffer.concat(chunks)):reject(new HttpError(422,'VALIDATION_ERROR','Unable to decode this photograph.')));
    child.stdin.end(bytes);
  });
}
async function upload(req,res,actor){
  const b=await readJson(req,5700000);
  const model=modelCode(b.model);
  const formats={'image/jpeg':'JPEG','image/png':'PNG','image/webp':'WEBP'};
  if(!Object.hasOwn(formats,b.type)||b.pendingReview!==true||typeof b.bytes!=='string'||!/^([A-Za-z0-9+/]+={0,2})$/.test(b.bytes)) invalid('Submit a supported exact-model image for independent review.');
  const bytes=Buffer.from(b.bytes,'base64');
  if(!bytes.length||bytes.length>4194304) invalid('Maximum upload is 4 MiB.');
  const decoded=await decodePhoto(bytes,formats[b.type]);
  const width=decoded.readUInt32BE(0), height=decoded.readUInt32BE(4);
  const image=decoded.subarray(8);
  const asset=await registerPhoto(model,bytes,b.type,image,width,height,actor.user.id);
  reply(res,201,{asset});
}
export async function productManagement(req,res,path,userRequest,actor){
  if(path==='/api/admin/products/images' && req.method==='POST'){await upload(req,res,actor);return true;}
  const media=path.match(/^\/api\/admin\/products\/images\/([a-f0-9-]+)(\/review)?$/);
  if(media && media[2] && req.method==='POST'){await reviewPhoto(req,res,media[1],actor,userRequest);return true;}
  if(media && !media[2] && req.method==='GET'){await servePhoto(res,media[1],true);return true;}
  const match=path.match(/^\/api\/admin\/products(?:\/([a-z0-9-]+))?$/);
  if(!match)return false;
  if(req.method==='GET'&&!match[1]){
    const products=[];
    for(let offset=0;;offset+=100){
      const batch=await userRequest('/rest/v1/products?select=id,model,category_id,record,is_visible,created_at,updated_at&order=id.asc&limit=100&offset='+offset);
      products.push(...batch.filter(p=>!excluded.has(p.model.toUpperCase())));
      if(batch.length<100)break;
    }
    const assets=[];
    for(let offset=0;;offset+=100){
      const batch=await userRequest('/rest/v1/product_media?select=id,model,approved,uploaded_by&order=id&limit=100&offset='+offset);
      assets.push(...batch); if(batch.length<100)break;
    }
    reply(res,200,{products,assets,reviewer:actor.profile.role==='SUPER_ADMIN',actorId:actor.user.id});return true;
  }
  const create=!match[1] && req.method==='POST';
  if(!create && !(match[1] && req.method==='PATCH'))return false;
  const b=await readJson(req,131072);
  const r=b.record;
  if(!r||Array.isArray(r)||typeof r!=='object'||typeof b.isVisible!=='boolean')invalid('Invalid product form.');
  const model=modelCode(b.model);
  const id=create?model.toLowerCase():match[1];
  const row=create?null:(await userRequest('/rest/v1/products?id=eq.'+id+'&select=record,model,updated_at'))[0];
  if(!create && (!row || row.model!==model || row.updated_at!==b.expected))throw new HttpError(409,'CONFLICT','Record changed. Reload before saving.');
  const category=categories.find(c=>c.id===r.categoryId);
  if(!category || (r.subcategory && !category.subcategories.includes(r.subcategory)))invalid('Invalid category or subcategory.');
  const patch={subcategory:r.subcategory||null};
  for(const [k,max] of Object.entries({name:240,brand:100,description:5000,seoTitle:180,seoDescription:500}))patch[k]=plain(r[k]??'',max);
  if(typeof r.featured!=='boolean'||!Array.isArray(r.features)||r.features.length>80)invalid('Invalid features.');
  patch.featured=r.featured; patch.features=r.features.map(v=>plain(v,2000));
  if(r.source)patch.pendingSource=plain(r.source,1200);
  if(patch.features.length && JSON.stringify(patch.features)!==JSON.stringify(row?.record.features)){
    if(!/^https:\/\/(?:www\.|web\.)?cpplusworld\.com\/[^\s]+$/i.test(r.source||''))invalid('Changed features require an official source URL.');
    // Source evidence requires separate verification.
  }
  patch.resolutionMp=r.resolutionMp;
  if(patch.resolutionMp!==null && !(Number.isFinite(patch.resolutionMp)&&patch.resolutionMp>0&&patch.resolutionMp<=1000))invalid('Invalid resolution.');
  if(r.specifications===null||typeof r.specifications!=='object'||Array.isArray(r.specifications)||Object.keys(r.specifications).length>250)invalid('Invalid specification list.');
  patch.specifications={};
  for(const [key,value] of Object.entries(r.specifications)){
    if(!plain(key,150)||['__proto__','constructor','prototype'].includes(key))invalid('Invalid specification name.');
    const old=row?.record;
    if(old && Object.hasOwn(old.specifications||{},key) && JSON.stringify(old.specifications[key])===JSON.stringify(value)){
      patch.specifications[key]=value;
    } else {
      patch.specifications[key]=plain(value,2500);
      if(!/^https:\/\/(?:www\.|web\.)?cpplusworld\.com\/[^\s]+$/i.test(r.source||''))invalid('Changed specifications require an official exact-model source URL.');
    }
  }
  if (r.galleryPaths?.length) invalid('Image does not belong to the private media library.');
  const editable=['name','brand','description','seoTitle','seoDescription','categoryId','subcategory','source','featured','features','specifications','resolutionMp','mediaIds','galleryPaths'];
  if(Object.keys(r).some(k=>!editable.includes(k))) invalid('Protected or unknown product field.');
  if(!Array.isArray(r.mediaIds??[]) || (r.mediaIds||[]).length>30 || !(r.mediaIds||[]).every(validMediaId)) invalid('Invalid media selection.');
  patch.mediaIds=[...new Set(r.mediaIds??row?.record.mediaIds??[])];
  if(patch.mediaIds.length){
    const allowed=await userRequest('/rest/v1/product_media?select=id&model=eq.'+model+'&id=in.('+patch.mediaIds.join(',')+')');
    if(allowed.length!==patch.mediaIds.length) invalid('Image does not belong to this model.');
  }
  if(create)patch.model=model;
  const product=await userRequest('/rest/v1/rpc/admin_save_catalogue_product',{method:'POST',body:{p_id:id,p_changes:patch,p_category:category.id,p_visible:b.isVisible,p_expected:create?null:b.expected}});
  reply(res,create?201:200,{product});return true;
}
