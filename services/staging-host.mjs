import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createApiServer } from './admin-api.mjs';
import { config, missingConfig } from './api/config.mjs';

const root = await realpath(process.env.STAGING_SITE_DIRECTORY || '/srv/site');
const loopback = process.env.STAGING_LOOPBACK_TEST === '1';
const origin = new URL(config.appOrigin);
if (missingConfig().length || config.supabaseUrl !== 'https://fszrsispjxunckknphaw.supabase.co' ||
    !(origin.protocol === 'https:' || (loopback && origin.hostname === '127.0.0.1'))) {
  throw Error('Staging configuration or origin mismatch.');
}
await stat(resolve(root, 'index.html'));
const enabled = process.env.STAGING_PRODUCT_EDITOR_ENABLED === 'true';
const allowed = /^\/(?:[\w-]+\.html|admin\/[\w-]+\.html|(?:css|js)\/(?:[\w-]+\/)*[\w.-]+\.(?:css|js)|assets\/(?:icons|images\/(?:logo|hero|services))\/(?:[\w-]+\/)*[\w.-]+\.(?:svg|png|jpe?g|webp|ico))$/;
const types = {html:'text/html', js:'text/javascript', css:'text/css', svg:'image/svg+xml', png:'image/png', jpeg:'image/jpeg', jpg:'image/jpeg', webp:'image/webp', ico:'image/x-icon'};

async function stageRoute(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (!enabled && (path === '/admin/products.html' || /^\/api\/admin\/products(?:\/|$)/.test(path))) {
    res.writeHead(503, {'Cache-Control': 'no-store'}).end('Product editor is disabled.');
    return true;
  }
  if (path.startsWith('/api/')) return false;
  const route = path.endsWith('/') ? path + 'index.html' : path;
  let file;
  if (allowed.test(route) && ['GET','HEAD'].includes(req.method)) {
    try { file = await realpath(resolve(root, '.' + route)); }
    catch (error) { if (!['ENOENT','ENOTDIR'].includes(error.code)) throw error; }
  }
  if (!file || !file.startsWith(root + sep) || !(await stat(file)).isFile()) {
    res.writeHead(404).end();
    return true;
  }
  res.writeHead(200, {'Content-Type': types[extname(file).slice(1)], 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff'});
  if (req.method === 'HEAD') res.end();
  else await pipeline(createReadStream(file), res);
  return true;
}
const server = createApiServer(stageRoute);
server.requestTimeout = 60000;
server.listen(Number(process.env.PORT || 10000), loopback ? '127.0.0.1' : '0.0.0.0', () => console.log('Staging catalogue listener ready.'));
