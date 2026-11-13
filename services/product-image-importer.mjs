import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cataloguePath = path.join(root, 'js', 'data', 'products.json');
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const retryFailed = args.has('--retry-failed');
const selectedModel = process.argv.find((arg) => arg.startsWith('--model='))?.slice('--model='.length) || '';
const allowedHosts = new Set(['cpplusworld.com']);
const maxBytes = 10 * 1024 * 1024;
const timeoutMs = 20000;
const pauseMs = 1200;

const products = JSON.parse(await readFile(cataloguePath, 'utf8'));
const targets = products.filter((product) => !selectedModel || product.model === selectedModel);
if (selectedModel && targets.length === 0) throw new Error(`Exact model not found in catalogue: ${selectedModel}`);

function imageState(product) {
  return product.image || {};
}

function safeSource(product) {
  const candidate = imageState(product).sourceUrl;
  let url;
  try { url = new URL(candidate); } catch { throw new Error('No valid candidate image URL.'); }
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname.toLowerCase()) || url.username || url.password) {
    throw new Error('Candidate URL is outside the HTTPS source allowlist.');
  }
  return url;
}

function eligible(product) {
  if (product.imageVerificationStatus === 'NOT_FOUND') return 'Exact model source is unresolved.';
  const image = imageState(product);
  if (product.imagePermissionStatus !== 'PERMITTED' && image.permissionStatus !== 'PERMITTED') return 'Permission is not marked PERMITTED.';
  if (!String(image.permissionEvidence || product.imagePermissionEvidence || '').trim()) return 'Written permission evidence is not recorded.';
  if (product.imageVerificationStatus !== 'VERIFIED' || image.matchStatus !== 'VERIFIED' || product.imageModelMatchVerified !== true) return 'Exact model and image have not been manually verified.';
  if (!String(image.matchEvidence || product.imageMatchEvidence || '').trim()) return 'Exact image/model review evidence is not recorded.';
  if (image.retrievalStatus === 'FAILED' && !retryFailed) return 'Previous failure requires --retry-failed.';
  return '';
}

async function robotsAllows(url) {
  const robotsUrl = new URL('/robots.txt', url.origin);
  const response = await fetch(robotsUrl, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'VisionTechProductImageImporter/1.0 (respectful asset retrieval)' } });
  if (!response.ok) throw new Error(`Cannot verify robots.txt (${response.status}); host retrieval paused.`);
  const lines = (await response.text()).split(/\r?\n/);
  let inWildcard = false;
  let hasWildcard = false;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const field = match[1].toLowerCase();
    if (field === 'user-agent') {
      inWildcard = match[2].trim() === '*';
      hasWildcard ||= inWildcard;
    } else if (inWildcard && field === 'disallow') {
      const rule = match[2].trim();
      if (rule && (url.pathname === rule || url.pathname.startsWith(rule))) return false;
    }
  }
  return hasWildcard || lines.length === 0;
}

function identifyImage(bytes, contentType = '') {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { ext: '.png', mime: 'image/png' };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: '.jpg', mime: 'image/jpeg' };
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return { ext: '.webp', mime: 'image/webp' };
  throw new Error(`Response is not a supported raster image (reported ${contentType || 'unknown type'}).`);
}

async function saveCatalogue() {
  const temp = `${cataloguePath}.tmp`;
  await writeFile(temp, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
  await (await import('node:fs/promises')).rename(temp, cataloguePath);
}

const processedHashes = new Map();
for (const product of targets) {
  const blocked = eligible(product);
  if (blocked) {
    console.log(`${product.model}: SKIPPED — ${blocked}`);
    continue;
  }
  const url = safeSource(product);
  if (!apply) {
    console.log(`${product.model}: READY — exact source host ${url.hostname}; use --apply only after written permission and image match verification.`);
    continue;
  }
  try {
    if (!await robotsAllows(url)) throw new Error('robots.txt disallows this image path.');
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'VisionTechProductImageImporter/1.0 (authorized product image retrieval)' } });
    if (!response.ok) throw new Error(`Image server returned HTTP ${response.status}.`);
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > maxBytes) throw new Error('Image exceeds the 10 MB limit.');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > maxBytes) throw new Error('Image is empty or exceeds the 10 MB limit.');
    const format = identifyImage(bytes, response.headers.get('content-type'));
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (processedHashes.has(hash)) throw new Error(`Duplicate image bytes match ${processedHashes.get(hash)}.`);
    const directory = String(product.imageDirectory || product.categoryId || 'unassigned').toLowerCase();
    if (!/^[a-z0-9-]+$/.test(directory) || !/^[A-Za-z0-9-]+$/.test(product.model)) throw new Error('Unsafe category folder or model filename.');
    const relativePath = `assets/images/products/${directory}/${product.model}${format.ext}`;
    const absolutePath = path.join(root, ...relativePath.split('/'));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    const handle = await open(absolutePath, 'wx');
    try { await handle.writeFile(bytes); } finally { await handle.close(); }
    processedHashes.set(hash, product.model);
    product.imagePath = relativePath;
    product.image.localPath = relativePath;
    product.image.retrievalStatus = 'DOWNLOADED';
    product.image.displayStatus = 'NOT_TESTED';
    product.image.sha256 = hash;
    product.image.byteLength = bytes.length;
    product.image.mimeType = format.mime;
    product.imageVerificationStatus = 'DOWNLOADED';
    await saveCatalogue();
    console.log(`${product.model}: DOWNLOADED — ${relativePath} (${bytes.length} bytes, ${hash})`);
  } catch (error) {
    product.image ||= {};
    product.image.retrievalStatus = 'FAILED';
    product.image.failureReason = String(error.message || 'Download failed').slice(0, 240);
    await saveCatalogue();
    console.error(`${product.model}: FAILED — ${product.image.failureReason}`);
  }
}
