// Store snapshots on an encrypted, access-controlled volume outside the web root.
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { supabaseHeaders } from './api/supabase.mjs';

const [operation, destination, target]=process.argv.slice(2);
if(!destination || !['backup','restore-local'].includes(operation)) throw Error('Use backup or restore-local, directory, and expected URL hostname.');
const url=new URL(process.env.SUPABASE_URL);
if(url.hostname!==target || (url.protocol!=='https:' && url.hostname!=='127.0.0.1') ||
    (operation==='restore-local' && url.hostname!=='127.0.0.1')) throw Error('Unexpected storage target.');
const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!key)throw Error('Server credential required.');
const dir=resolve(destination), root=fileURLToPath(new URL('../',import.meta.url));
const parent=await realpath(dirname(dir));
const relativeDir=relative(root,resolve(parent,dir.slice(dirname(dir).length+1)));
if(!relativeDir || (!relativeDir.startsWith('..')&&!isAbsolute(relativeDir)))throw Error('Use an external backup directory.');
const headers=supabaseHeaders(key,'',true);
const sha=b=>createHash('sha256').update(b).digest('hex');
const prefix='/storage/v1/object/visiontech-product-media/';
async function get(path){
  const res=await fetch(new URL(path,url),{headers,redirect:'error'});
  if(!res.ok)throw Error('Backup read failed: HTTP '+res.status);
  return Buffer.from(await res.arrayBuffer());
}
async function registry(){
  const rows=[];
  for(let offset=0;;offset+=100){
    const batch=JSON.parse(await get('/rest/v1/product_media?select=*&order=id&limit=100&offset='+offset));
    rows.push(...batch);if(batch.length<100)return rows;
  }
}
function files(rows){
  const objects=new Map();
  for(const row of rows){
    if(!/^[A-Z0-9][A-Z0-9-]{0,99}$/.test(row.model))throw Error('Invalid model in manifest.');
    for(const [kind,hash,type] of [['original',row.original_sha,row.original_type],['jpeg',row.jpeg_sha,'image/jpeg']]){
      if(!/^[a-f0-9]{64}$/.test(hash) || !['image/png','image/jpeg','image/webp'].includes(type))throw Error('Invalid file in manifest.');
      objects.set(row.model+'/'+kind+'/'+hash,{hash,type});
    }
  }
  return objects;
}
if(operation==='backup'){
  const rows=await registry();
  await mkdir(dir,{mode:0o700});
  const seen=new Set();
  for(const [object,{hash}] of files(rows)){
    const bytes=await get(prefix+object);
    if(sha(bytes)!==hash)throw Error('Stored object digest mismatch.');
    if(!seen.has(hash))await writeFile(join(dir,hash),bytes,{flag:'wx',mode:0o600});
    seen.add(hash);
  }
  // Written last so an interrupted export is never reported as complete.
  await writeFile(join(dir,'manifest.json'),JSON.stringify({version:1,rows}),{flag:'wx',mode:0o600});
  console.log('Backed up and verified '+rows.length+' asset records.');
}else{
  const manifest=JSON.parse(await readFile(join(dir,'manifest.json')));
  if(manifest.version!==1)throw Error('Unsupported manifest.');
  for(const [object,{hash,type}] of files(manifest.rows)){
    const bytes=await readFile(join(dir,hash)); if(sha(bytes)!==hash)throw Error('Backup file digest mismatch.');
    const route=prefix+object;
    await fetch(new URL(route,url),{method:'POST',redirect:'error',headers:{...headers,'Content-Type':type,'x-upsert':'false'},body:bytes});
    if(sha(await get(route))!==hash)throw Error('Restore verification failed.');
  }
  console.log('Restored and read-verified immutable object bytes. Database metadata requires its matching database backup.');
}
