// Assemble the public host from approved directories. Never publish the project root.
import { mkdir, readdir, copyFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
if(!process.argv[2]) throw Error('Supply a new output directory.');
const destination=resolve(process.argv[2]);
if(['js','assets','css','admin'].some(dir=>destination.toLowerCase().startsWith(resolve(root,dir).toLowerCase())))throw Error('Choose an output directory outside the input folders.');
await mkdir(destination); // refuse to reuse a directory containing stale assets
async function copy(relative) {
  await mkdir(dirname(join(destination,relative)),{recursive:true});
  await copyFile(join(root,relative),join(destination,relative));
}
async function include(relative,extensions){
  for(const entry of await readdir(join(root,relative),{withFileTypes:true})){
    const path=join(relative,entry.name);
    if(entry.isDirectory()) await include(path,extensions);
    else if(entry.isFile() && extensions.test(entry.name)) await copy(path);
  }
}
for(const entry of await readdir(root,{withFileTypes:true})){
  if(entry.isFile() && /\.html$/.test(entry.name)) await copy(entry.name);
}
for(const [dir,pattern] of [['admin',/\.html$/],['css',/\.css$/],['js',/\.js$/],
  ['assets/icons',/\.(svg|png|ico)$/],['assets/images/logo',/\.(jpeg|png|ico)$/],
  ['assets/images/hero',/\.(jpe?g|png|webp)$/],['assets/images/services',/\.(jpe?g|png|webp)$/]]) await include(dir,pattern);
console.log('Static site packaged. Route /api to the backend on the same origin.');
