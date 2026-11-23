import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {config} from '../api/config.mjs';
import {handle} from '../admin-api.mjs';
import {handleError} from '../api/http.mjs';
import {sb} from '../api/supabase.mjs';
import {authAdmin} from '../api/staff-service.mjs';
const exe=process.env.SUPABASE_CLI || 'supabase';
assert.match(await readFile(resolve('vt-p11b-local/supabase/config.toml'),'utf8'),/^project_id = "vt-p11b-local"$/m);
const root=(await import('node:url')).fileURLToPath(new URL('../../',import.meta.url));
const local=JSON.parse(execFileSync(exe,['status','--workdir',resolve('vt-p11b-local'),'--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(new URL(local.API_URL).hostname,'127.0.0.1');
Object.assign(config,{supabaseUrl:local.API_URL,publishableKey:local.PUBLISHABLE_KEY||local.ANON_KEY,secretKey:local.SECRET_KEY||local.SERVICE_ROLE_KEY,rateSecret:randomUUID()+randomUUID(),resendKey:''});
const server=createServer(async(req,res)=>{
try {
 if(req.url.startsWith('/api/')) return await handle(req,res);
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/favicon.ico'){res.writeHead(204).end();return}
 if(!['/products.html','/services.html','/product-details.html','/index.html','/contact.html'].includes(path)&&!/^\/(admin|assets|css|js)\/[\w./-]+$/.test(path)||path.includes('..')){res.writeHead(404).end();return}
 const file=await readFile(resolve(root,'.'+path));
 res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream'}).end(file);
} catch(e){handleError(e,req,res)}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r)); config.appOrigin='http://127.0.0.1:'+server.address().port;
const password='Aa7!'+randomBytes(24).toString('hex'), users={};
async function request(path,cookie='',body){
 const res=await fetch(config.appOrigin+path,{method:body?'POST':'GET',headers:{Origin:config.appOrigin,Cookie:cookie,'Content-Type':'application/json'},body:body&&JSON.stringify(body)});
 return {code:res.status,data:await res.json(),cookie:res.headers.getSetCookie()[0]?.split(';')[0]};
}
const overview=actor=>request('/api/admin/overview',actor?.cookie);
try{
 assert.equal((await overview()).code,401);console.log('PASS anonymous HTTP 401');
 const marker=randomUUID();
 for(const role of ['SUPER_ADMIN','ADMIN','STAFF','DISABLED']){
  const email=marker+role+'@example.invalid';
  const user=await authAdmin('/admin/users',{method:'POST',body:{email,password,email_confirm:true}});
  await sb('/rest/v1/profiles?id=eq.'+user.id,{service:true,method:'PATCH',body:{role:role==='DISABLED'?'STAFF':role,account_state:role==='DISABLED'?'DISABLED':'ACTIVE'}});
  const result=await request('/api/auth/login','',{email,password}); assert.equal(result.code,role==='DISABLED'?403:200);
  users[role]={email,id:user.id,role,cookie:result.cookie};
 }
 console.log('PASS three role logins and disabled rejection');

 const seedEnv={...process.env,SUPABASE_URL:local.API_URL,SUPABASE_SECRET_KEY:config.secretKey};
 const runSeed=()=>execFileSync(process.execPath,[resolve(root,'services/seed-products.mjs')],{env:seedEnv});
 runSeed();
 const pub=async()=>(await request('/api/public/products')).data.products;
 const catalogue=JSON.parse(await readFile(resolve(root,'js/data/products.json')));
 assert.deepEqual((await pub()).map(p=>p.model).sort(),catalogue.map(p=>p.model).sort());
 assert((await pub()).every(p=>!p.publishedMedia.length && !p.imagePath));
 console.log('PASS 19 published seed identities and placeholders');
 const model=catalogue[0].model, endpoint='/api/admin/products', mgr=users.ADMIN, owner=users.SUPER_ADMIN;
 async function api(who,path,method,body,status){
   const res=await fetch(config.appOrigin+path,{method,headers:{Origin:config.appOrigin,Cookie:who?.cookie||'','Content-Type':'application/json'},body:body&&JSON.stringify(body)});
   assert.equal(res.status,status,path+' '+(res.ok?'':(await res.clone().text()).slice(0,200)));return res;
 }
 for(const actor of [mgr,owner,users.STAFF]){
   const response=await fetch(local.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email:actor.email,password})});
   actor.token=(await response.json()).access_token;assert(actor.token);
 }
 async function direct(actor,path,method,body){
   return fetch(local.API_URL+path,{method,headers:{apikey:config.publishableKey,...(actor?{Authorization:'Bearer '+actor.token}:{}),'Content-Type':'application/json'},body:body&&JSON.stringify(body)});
 }
 const assets=()=>request(endpoint,mgr.cookie).then(x=>x.data.products);
 let row=(await assets()).find(p=>p.model===model);
 const record={name:'Disposable edit',categoryId:row.category_id,subcategory:row.record.subcategory,featured:true,
 features:row.record.features,specifications:row.record.specifications,resolutionMp:row.record.resolutionMp,mediaIds:[]};
 async function save(visible,who=mgr){
   const res=await api(who,endpoint+'/'+row.id,'PATCH',{model,isVisible:visible,expected:row.updated_at,record},200);
   row=(await res.json()).product;
 }
 const basis={p_id:row.id,p_changes:{imagePermissionStatus:'PERMITTED'},p_category:row.category_id,p_visible:true,p_expected:row.updated_at};
 for(const actor of [null,users.STAFF,mgr,owner]){
   const result=await direct(actor,'/rest/v1/rpc/admin_save_catalogue_product','POST',basis);
   assert(!result.ok);
 }
 for(const name of ['admin_update_product','admin_create_product']){
   const body=name==='admin_update_product'?{p_id:row.id,p_patch:{expected:row.updated_at,verification:{status:'verified'}},p_is_visible:true}:{p_record:{id:'vt-review',model:'VT-REVIEW',categoryId:'nvr',specificationEvidence:{fake:{status:'verified'}}}};
   assert(!(await direct(mgr,'/rest/v1/rpc/'+name,'POST',body)).ok);
 }
 for(const actor of [null,users.STAFF]){
   await api(actor,endpoint,'POST',{model:'VT-NEW',isVisible:false,record},actor?403:401);
   const directWrite=await direct(actor,'/rest/v1/products','POST',{id:'vt-new',model:'VT-NEW',category_id:'nvr',record:{}});assert(!directWrite.ok);
 }
 await api(mgr,endpoint+'/'+row.id,'PATCH',{model,expected:row.updated_at,isVisible:true,record:{...record,verification:{status:'verified'}}},422);
 for(const retired of ['CP-Z42Q','CP-UNC-DA41L3C-Q2','CP-DNW-HPU8G2-6-V3'])await api(mgr,endpoint,'POST',{model:retired,isVisible:true,record},422);
 const newRecord=await (await api(owner,endpoint,'POST',{model:'VT-NEW',isVisible:false,record:{...record,features:[],specifications:{},resolutionMp:null,categoryId:'nvr',subcategory:null}},201)).json();
 assert.equal(newRecord.product.record.model,'VT-NEW');
 await save(false);runSeed();assert(!(await pub()).some(v=>v.model===model));
 const preserved=(await assets()).find(p=>p.id===row.id);assert.equal(preserved.record.name,'Disposable edit');assert(!preserved.is_visible);
 console.log('PASS protected fields across three RPCs and API, direct table denials, three exclusions, repeat seed with archived admin edit');
 const png=execFileSync('python',['-c',"from PIL import Image;import io,sys; b=io.BytesIO();Image.new('RGB',(4,4),'blue').save(b,'PNG');sys.stdout.buffer.write(b.getvalue())"]);
 const upload={model,pendingReview:true,type:'image/png',bytes:png.toString('base64')};
 for(const actor of [null,users.STAFF])await api(actor,endpoint+'/images','POST',upload,actor?403:401);
 for(const invalid of [{type:'image/jpeg'},{bytes:'AAAA'},{pendingReview:false}])await api(mgr,endpoint+'/images','POST',{...upload,...invalid},422);
 await api(mgr,endpoint+'/images','POST',{...upload,bytes:Buffer.alloc(4194305).toString('base64')},422);
 const {asset}=await (await api(mgr,endpoint+'/images','POST',upload,201)).json();
 const again=await (await api(mgr,endpoint+'/images','POST',upload,201)).json();
 assert.equal(again.asset.id,asset.id);
 const mediaPath='/api/public/product-images/'+asset.id, review=endpoint+'/images/'+asset.id+'/review';
 record.mediaIds=[asset.id];await save(true);
 await api(null,mediaPath,'GET',null,404);
 await api(mgr,endpoint+'/images/'+asset.id,'GET',null,200);
 await api(mgr,review,'POST',{approved:true,evidence:'Fixture rights record'},403);
 await api(owner,review,'POST',{approved:true,evidence:'Fixture rights record'},200);
 assert.deepEqual((await pub()).find(p=>p.model===model).publishedMedia,[asset.id]);
 const rendered=Buffer.from(await (await api(null,mediaPath,'GET',null,200)).arrayBuffer());
 const [meta]=await sb('/rest/v1/product_media?id=eq.'+asset.id,{service:true});
 assert.equal(meta.original_bytes,png.length);assert.equal(meta.jpeg_bytes,rendered.length);assert.equal(meta.width,4);assert.equal(meta.height,4);
 for(const actor of [null,users.STAFF,mgr,owner]){
   for(const [method,data] of [['PATCH',{approved:true}],['DELETE',null]]){
     const result=await direct(actor,'/rest/v1/product_media?id=eq.'+asset.id,method,data);assert(!result.ok);
   }
 }
 const forged=await direct(mgr,'/rest/v1/rpc/review_product_media','POST',{p_id:asset.id,p_approved:true,p_evidence:'Direct fixture'});assert(!forged.ok);
 const prefix='/storage/v1/object/visiontech-product-media/'+model+'/';
 for(const actor of [null,users.STAFF,mgr]){
   const auth={apikey:config.publishableKey,...(actor?{Authorization:'Bearer '+actor.token}:{})};
   for(const method of ['GET','PUT','DELETE','POST']){
     const resp=await fetch(local.API_URL+prefix+'jpeg/'+meta.jpeg_sha,{method,headers:{...auth,'Content-Type':'image/jpeg'},body:['PUT','POST'].includes(method)?rendered:undefined});assert(!resp.ok,method+' unexpectedly allowed');
   }
 }
 const own=await (await api(owner,endpoint+'/images','POST',{...upload,model:catalogue[1].model},201)).json();
 assert(!(await direct(owner,'/rest/v1/rpc/review_product_media','POST',{p_id:own.asset.id,p_approved:true,p_evidence:'Self-review fixture'})).ok);
 await api(owner,endpoint+'/images/'+own.asset.id+'/review','POST',{approved:true,evidence:'Fixture'},403);
 await save(false,owner);await api(null,mediaPath,'GET',null,404);await save(true);
 await api(owner,review,'POST',{approved:false,evidence:'Withdrawal fixture'},200);await api(null,mediaPath,'GET',null,404);
 console.log('PASS private upload validation, private preview, duplicate upload, independent approval, direct storage restrictions, withdrawal and archive');
 const fs=await import('node:fs/promises'), temp=await fs.mkdtemp(resolve((await import('node:os')).tmpdir(),'vt-media-test-')), snapshot=resolve(temp,'snapshot');
 const backup=(action)=>execFileSync(process.execPath,[resolve(root,'services/product-media-backup.mjs'),action,snapshot,'127.0.0.1'],{env:seedEnv});
 try{
   backup('backup');
   const original=await fs.readFile(resolve(snapshot,meta.original_sha));assert.deepEqual(original,png);
   for(const [kind,hash] of [['original',meta.original_sha],['jpeg',meta.jpeg_sha]]){
     const resp=await fetch(local.API_URL+prefix+kind+'/'+hash,{method:'DELETE',headers:{apikey:config.secretKey}});assert(resp.ok);
     assert(!(await fetch(local.API_URL+prefix+kind+'/'+hash,{headers:{apikey:config.secretKey}})).ok);
   }
   backup('restore-local');assert.deepEqual(rendered,Buffer.from(await (await api(mgr,endpoint+'/images/'+asset.id,'GET',null,200)).arrayBuffer()));
 }finally{await fs.rm(temp,{recursive:true});assert(!(await fs.stat(temp).catch(()=>null)));}
 console.log('PASS original and JPEG byte backup, confirmed absence, restore and independent preview');
 const browser=spawn('python',[resolve(root,'services/tests/product-pages-local.py')],{stdio:['pipe','inherit','inherit']});
 browser.stdin.end(JSON.stringify({origin:config.appOrigin,models:catalogue.map(p=>p.model)}));
 assert.equal(await new Promise(r=>browser.on('close',r)),0);
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
