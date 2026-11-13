/**
 * CP PLUS product-image acquisition and audit pipeline.
 *
 * Safe default: `node services/acquire-cpplus-images.mjs --discover`
 *
 * The script always creates the mandated folder structure and source manifest.
 * It only retrieves image bytes with `--download` when rightsConfirmed and
 * rightsEvidence are set in the configuration AND robots.txt permits the image
 * URL.  Files are never overwritten; stale/incomplete work can be retried.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { access, copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'services', 'cpplus-product-image-config.json');
const library = path.join(root, 'assets', 'images', 'products');
const manifestPath = path.join(library, 'product-image-manifest.json');
const reportPath = path.join(library, 'acquisition-report.md');
const args = new Set(process.argv.slice(2));
const selected = process.argv.find((arg) => arg.startsWith('--model='))?.slice(8).toUpperCase();
const download = args.has('--download');
const retry = args.has('--retry-failed');
const timeoutMs = 25000;
const pauseMs = 850;

const config = JSON.parse(await readFile(configPath, 'utf8'));
const allProducts = config.products;
const products = selected ? allProducts.filter((p) => p.model === selected) : allProducts;
if (selected && !products.length) throw new Error(`No configured product has exact model ${selected}.`);
const legalDownload = download && config.rightsConfirmed === true && String(config.rightsEvidence || '').trim();
if (download && !legalDownload) console.warn('Download disabled: set rightsConfirmed=true and document rightsEvidence in the configuration.');

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cleanText = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&(?:amp|#38);/g, '&').replace(/&(?:quot|#34);/g, '"').replace(/&#(?:39|x27);/gi, "'").replace(/\s+/g, ' ').trim();
const sourceHeaders = { 'User-Agent': 'VisionTechSolutions/1.0 product-image auditor (respectful, low-volume)' };

function safeUrl(value, base) {
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' && config.sourcePolicy.officialHosts.includes(url.hostname.toLowerCase()) ? url.href : null;
  } catch { return null; }
}

async function fetchText(url) {
  const response = await fetch(url, { headers: sourceHeaders, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { response, text: await response.text() };
}

function parseRobots(text) {
  const disallow = [];
  let applies = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const field = match[1].toLowerCase(); const value = match[2].trim();
    if (field === 'user-agent') applies = value === '*';
    if (applies && field === 'disallow' && value) disallow.push(value);
  }
  return disallow;
}

let robots = [];
try { robots = parseRobots((await fetchText('https://cpplusworld.com/robots.txt')).text); } catch (error) { console.warn(`robots.txt unavailable: ${error.message}`); }
function robotsAllows(url) {
  const pathname = new URL(url).pathname;
  return !robots.some((rule) => pathname.startsWith(rule));
}

function imageCandidates(html, pageUrl, model) {
  const candidates = [];
  for (const tagMatch of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = tagMatch[0];
    const get = (name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))?.[2] || '';
    const src = get('src') || get('data-src') || get('data-lazy-src');
    const alt = get('alt');
    const source = safeUrl(src, pageUrl);
    if (source && (alt.toUpperCase().includes(model) || src.includes('/prodassets/product/'))) candidates.push(source);
  }
  return [...new Set(candidates)];
}

function productPageFromSearch(html, searchUrl, model) {
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => {
    const href = match[1].match(/\bhref\s*=\s*(["'])([^"']*)\1/i)?.[2] || '';
    return { url: safeUrl(href, searchUrl), label: cleanText(match[2]) };
  }).filter((item) => item.url);
  const exactPath = `/${model.toLowerCase()}`;
  return anchors.find((item) => new URL(item.url).pathname.toLowerCase() === exactPath)?.url
    || anchors.find((item) => new RegExp(`(^|[^A-Z0-9])${escape(model)}([^A-Z0-9]|$)`, 'i').test(item.label))?.url
    || null;
}

async function ensureFolders(product) {
  await mkdir(path.join(library, product.category, ...(product.subcategory ? [product.subcategory] : []), product.model), { recursive: true });
}
function localFolder(product) { return path.join(library, product.category, ...(product.subcategory ? [product.subcategory] : []), product.model); }
function localRelative(value) { return path.relative(root, value).replaceAll('\\', '/'); }

function pngInfo(bytes) {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature) || bytes.subarray(12, 16).toString() !== 'IHDR') return null;
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), colourType = bytes[25];
  return { width, height, hasAlpha: colourType === 4 || colourType === 6 || bytes.includes(Buffer.from('tRNS')) };
}
async function runRemBg(input, output) {
  return new Promise((resolve) => {
    const child = spawn('rembg', ['i', input, output], { shell: true, windowsHide: true });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0 && existsSync(output)));
  });
}
async function sha256(file) { return createHash('sha256').update(await readFile(file)).digest('hex'); }
async function existingPngs(folder) {
  try { return (await readdir(folder)).filter((name) => name.toLowerCase().endsWith('.png')).map((name) => path.join(folder, name)); } catch { return []; }
}

const earlier = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : { schemaVersion: 1, products: [] };
const earlierByModel = new Map((earlier.products || []).map((item) => [item.model, item]));
const imageHashes = new Map();
for (const product of allProducts) for (const file of await existingPngs(localFolder(product))) imageHashes.set(await sha256(file), file);

async function discover(product) {
  await ensureFolders(product);
  const previous = earlierByModel.get(product.model);
  const folder = localFolder(product);
  const output = {
    model: product.model, category: product.category, subcategory: product.subcategory, detail: product.detail,
    folder: localRelative(folder), localPngPaths: [], sourceType: 'official', productPageUrl: null,
    candidates: [], status: 'UNRESOLVED', identityVerified: false, transparencyVerified: false,
    lastCheckedAt: new Date().toISOString(), notes: []
  };
  let searchUrl = `https://cpplusworld.com/products/search/${encodeURIComponent(product.model)}`;
  try {
    const search = await fetchText(searchUrl);
    const pageUrl = productPageFromSearch(search.text, search.response.url, product.model);
    if (!pageUrl) { output.status = 'NO_OFFICIAL_PRODUCT_PAGE'; output.notes.push('Official search returned no exact product link.'); return output; }
    await pause(pauseMs);
    const page = await fetchText(pageUrl);
    output.productPageUrl = page.response.url;
    output.identityVerified = new RegExp(`(^|[^A-Z0-9])${escape(product.model)}([^A-Z0-9]|$)`, 'i').test(cleanText(page.text));
    if (!output.identityVerified) { output.status = 'IDENTITY_NOT_VERIFIED'; output.notes.push('The exact model number was not found in the official page text.'); return output; }
    output.candidates = imageCandidates(page.text, page.response.url, product.model).map((sourceUrl) => ({ sourceUrl, sourceType: 'official', robotsAllowed: robotsAllows(sourceUrl) }));
    if (!output.candidates.length) { output.status = 'NO_OFFICIAL_IMAGE_CANDIDATES'; output.notes.push('Exact official page found, but no product image tags were found.'); return output; }
    const allowed = output.candidates.filter((item) => item.robotsAllowed);
    if (!allowed.length) { output.status = 'MANUAL_REVIEW_REQUIRED'; output.notes.push('Official product images are hosted on a robots-disallowed path; no image bytes were requested.'); return output; }
    if (!legalDownload) { output.status = 'READY_FOR_AUTHORIZED_DOWNLOAD'; output.notes.push('Robots permits at least one candidate; downloads await documented rights confirmation.'); return output; }
    const targets = retry ? allowed : allowed.slice(0, 12);
    for (const [index, candidate] of targets.entries()) {
      const destination = path.join(folder, index === 0 ? 'main.png' : `gallery-${String(index).padStart(2, '0')}.png`);
      if (existsSync(destination)) continue;
      await pause(pauseMs);
      const response = await fetch(candidate.sourceUrl, { headers: sourceHeaders, signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) { output.notes.push(`Candidate ${index + 1}: HTTP ${response.status}.`); continue; }
      const raw = Buffer.from(await response.arrayBuffer());
      const tmp = `${destination}.source`;
      await writeFile(tmp, raw, { flag: 'wx' });
      try {
        const prepared = await runRemBg(tmp, destination);
        if (!prepared) { output.notes.push(`Candidate ${index + 1}: rembg unavailable or failed; no final image saved.`); continue; }
        const bytes = await readFile(destination); const info = pngInfo(bytes); const hash = await sha256(destination);
        if (!info || !info.hasAlpha || imageHashes.has(hash)) { await rm(destination, { force: true }); output.notes.push(`Candidate ${index + 1}: rejected (invalid, opaque, or duplicate PNG).`); continue; }
        imageHashes.set(hash, destination);
      } finally { await rm(tmp, { force: true }); }
    }
  } catch (error) { output.status = 'LOOKUP_FAILED'; output.notes.push(String(error.message || error)); }
  const files = await existingPngs(folder);
  output.localPngPaths = [];
  let transparentCount = 0;
  for (const file of files) {
    const info = pngInfo(await readFile(file));
    if (info?.hasAlpha) transparentCount++;
    output.localPngPaths.push({ path: localRelative(file), width: info?.width ?? null, height: info?.height ?? null, sha256: await sha256(file), transparencyVerified: Boolean(info?.hasAlpha) });
  }
  if (files.length) { output.status = transparentCount === files.length ? 'COMPLETE' : 'MANUAL_REVIEW_REQUIRED'; output.transparencyVerified = transparentCount === files.length; }
  return output;
}

const discovered = [];
for (const product of products) { console.log(`Checking ${product.model}…`); discovered.push(await discover(product)); }
const replacement = new Map(discovered.map((item) => [item.model, item]));
const manifestProducts = allProducts.map((p) => replacement.get(p.model) || earlierByModel.get(p.model) || { model: p.model, status: 'NOT_YET_CHECKED' });
const totals = { totalProducts: allProducts.length, completeModels: manifestProducts.filter((x) => x.status === 'COMPLETE').length, manualReviewModels: manifestProducts.filter((x) => x.status === 'MANUAL_REVIEW_REQUIRED').length, pngImages: manifestProducts.reduce((n, x) => n + (x.localPngPaths?.length || 0), 0), transparentPngImages: manifestProducts.reduce((n, x) => n + (x.localPngPaths?.filter((p) => p.transparencyVerified).length || 0), 0) };
const manifest = { schemaVersion: 1, generatedAt: new Date().toISOString(), configuration: { rightsConfirmed: config.rightsConfirmed, robotsRuleCount: robots.length }, totals, products: manifestProducts };
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const rows = manifestProducts.map((item) => `| ${item.model} | ${item.status} | ${(item.localPngPaths || []).length} | ${item.productPageUrl || '—'} |`).join('\n');
const completed = manifestProducts.filter((item) => item.status === 'COMPLETE').map((item) => item.model);
const partial = manifestProducts.filter((item) => (item.localPngPaths || []).length > 0 && item.status !== 'COMPLETE').map((item) => item.model);
const noVerified = manifestProducts.filter((item) => !(item.localPngPaths || []).length).map((item) => item.model);
const manual = manifestProducts.filter((item) => item.status === 'MANUAL_REVIEW_REQUIRED' || item.status === 'NO_OFFICIAL_PRODUCT_PAGE').map((item) => item.model);
const paths = manifestProducts.map((item) => `- \`${path.join(library, item.category || '', ...(item.subcategory ? [item.subcategory] : []), item.model)}\``).join('\n');
await writeFile(reportPath, `# CP PLUS Image Acquisition Report\n\nGenerated: ${manifest.generatedAt}\n\n- Total products: ${totals.totalProducts}\n- Successfully processed models: ${completed.length || 'none'}${completed.length ? ` (${completed.join(', ')})` : ''}\n- Models with partial image collections: ${partial.length || 'none'}${partial.length ? ` (${partial.join(', ')})` : ''}\n- Models with no verified images: ${noVerified.length} (${noVerified.join(', ')})\n- Total PNG images acquired: ${totals.pngImages}\n- Transparent PNG images verified: ${totals.transparentPngImages}\n- Downloaded official-source images: 0\n- Downloaded third-party-source images: 0\n- Models requiring manual review: ${manual.length} (${manual.join(', ')})\n\n## Current results\n\n| Model | Status | Final PNGs | Official product page |\n| --- | --- | ---: | --- |\n${rows}\n\n## Local product folders\n\n${paths}\n\n## Limitations\n\nThe automated check respects the official robots policy. Images whose source path is disallowed are recorded but never fetched. Set documented rights in \`services/cpplus-product-image-config.json\` and use \`--download\` only for candidates allowed by robots.txt and the applicable CP PLUS terms. The pipeline never creates substitute or AI-generated product images.\n`);
console.log(JSON.stringify(totals));
