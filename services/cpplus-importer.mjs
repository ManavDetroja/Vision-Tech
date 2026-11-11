import http from 'node:http';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cataloguePath = path.join(root, 'js', 'data', 'products.json');
const allowedHosts = new Set(['cpplusworld.com', 'www.cpplusworld.com', 'web.cpplusworld.com']);
const port = Number(process.env.CPPLUS_IMPORTER_PORT || 4174);
const adminToken = process.env.CPPLUS_ADMIN_TOKEN || '';
const allowedOrigin = process.env.CPPLUS_IMPORTER_ORIGIN || 'http://127.0.0.1:5500';
const timeoutMs = 15000;
const minimumRequestGapMs = 2200;
const previewCache = new Map();
let robotsCache;
let lastFetchAt = 0;
let requestQueue = Promise.resolve();
let catalogueWriteQueue = Promise.resolve();

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20000) reject(new Error('Request body is too large.'));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Request JSON is invalid.')); }
    });
    request.on('error', reject);
  });
}

function decodeHtml(text = '') {
  return text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function stripTags(text = '') {
  return decodeHtml(text.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return match ? decodeHtml(match[2]) : '';
}

function readMeta(html, key) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    if ([attribute(tag, 'property'), attribute(tag, 'name'), attribute(tag, 'itemprop')].some((value) => value.toLowerCase() === key.toLowerCase())) {
      return attribute(tag, 'content');
    }
  }
  return '';
}

function safeOfficialUrl(value, base) {
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' && allowedHosts.has(url.hostname.toLowerCase()) ? url.href : null;
  } catch { return null; }
}

function normalizeModel(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9-]{3,48}$/.test(value.trim())) {
    throw new Error('Model number format is invalid. Use letters, digits, and hyphens only.');
  }
  return value.trim().toUpperCase();
}

function extractSpecifications(html) {
  const specifications = {};
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripTags(cell[1]));
    if (cells.length > 1 && cells[0] && cells.slice(1).join(' ').trim()) specifications[cells[0]] = cells.slice(1).join(' ').trim();
  }
  return specifications;
}

function extractLinks(html, pageUrl) {
  return [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map((match) => ({
    url: safeOfficialUrl(attribute(match[0].match(/<a\b[^>]*>/i)?.[0] || '', 'href'), pageUrl),
    label: stripTags(match[0])
  })).filter((item) => item.url);
}

function exactProductPage(modelNumber, html, pageUrl, existingProduct) {
  const text = stripTags(html);
  const escapedModel = modelNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const modelMatched = new RegExp(`(^|[^A-Z0-9])${escapedModel}([^A-Z0-9]|$)`, 'i').test(text);
  if (!modelMatched) return null;

  const headings = [...html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((item) => stripTags(item[1]));
  const title = readMeta(html, 'og:title') || readMeta(html, 'twitter:title') || headings.find((item) => item.toUpperCase().includes(modelNumber)) || '';
  const titleWithoutBrand = title.replace(/\s*[|–-]\s*CP PLUS.*$/i, '').trim();
  const titleName = titleWithoutBrand.replace(new RegExp(`^${escapedModel}\\s*[-|:]?\\s*`, 'i'), '').trim();
  const modelHeadingIndex = headings.findIndex((item) => item.toUpperCase().includes(modelNumber));
  const headingName = modelHeadingIndex >= 0
    ? headings.slice(modelHeadingIndex + 1).find((item) => item && !item.toUpperCase().includes(modelNumber) && !/^(datasheet|data sheet|user manual)$/i.test(item))
    : '';
  const officialName = titleName || headingName || '';
  const specs = extractSpecifications(html);
  const imageCandidates = [];
  const metaImage = readMeta(html, 'og:image') || readMeta(html, 'twitter:image');
  if (metaImage && metaImage.toUpperCase().includes(modelNumber)) imageCandidates.push(metaImage);
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const alt = attribute(tag, 'alt');
    const imageValue = attribute(tag, 'src') || attribute(tag, 'data-src') || attribute(tag, 'data-lazy-src');
    if (alt.toUpperCase().includes(modelNumber) || imageValue.toUpperCase().includes(modelNumber)) imageCandidates.push(imageValue);
  }
  const imageUrl = [...new Set(imageCandidates.map((value) => safeOfficialUrl(value, pageUrl)).filter(Boolean))][0] || null;
  const links = extractLinks(html, pageUrl);
  const pdfLinks = links.filter((item) => /\.pdf(?:$|[?#])/i.test(item.url));
  const datasheet = pdfLinks.find((item) => new RegExp(escapedModel, 'i').test(item.url) || /datasheet|data sheet/i.test(item.label)) || null;
  const description = readMeta(html, 'og:description') || readMeta(html, 'description') || '';
  const modelHeading = [...html.matchAll(/<h[1-3]\b[^>]*>[\s\S]*?<\/h[1-3]>/gi)].find((item) => stripTags(item[0]).toUpperCase().includes(modelNumber));
  const featureRegion = modelHeading ? html.slice(modelHeading.index, modelHeading.index + 14000) : '';
  const pdfPosition = featureRegion.search(/\.pdf(?:[?#'"\s])/i);
  const featureHtml = pdfPosition >= 0 ? featureRegion.slice(0, pdfPosition) : featureRegion;
  const features = [...featureHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((item) => stripTags(item[1]))
    .filter((item) => item.length > 12 && item.length < 500).slice(0, 30);
  const imageSource = imageUrl ? pageUrl : null;
  const imagePermissionStatus = 'pending';

  return {
    ...existingProduct,
    modelNumber,
    officialName,
    category: existingProduct?.categoryId || null,
    subcategory: existingProduct?.subcategory || null,
    description,
    features,
    specifications: specs,
    image: imageUrl ? { url: imageUrl, localPath: null, sourceUrl: imageSource } : null,
    gallery: [],
    datasheet: datasheet ? { url: datasheet.url, label: datasheet.label, localPath: null } : null,
    sources: { productPage: pageUrl, imageSource, datasheetSource: datasheet?.url || null },
    verification: {
      modelMatched: true,
      productNameFound: Boolean(officialName),
      specificationsVerified: Object.keys(specs).length > 0,
      imageVerified: Boolean(imageUrl),
      datasheetVerified: Boolean(datasheet && new RegExp(escapedModel, 'i').test(datasheet.url)),
      imagePermissionStatus,
      status: officialName && Object.keys(specs).length ? 'partially-verified' : 'needs-manual-review',
      verifiedAt: new Date().toISOString()
    },
    _sourceHeadings: headings
  };
}

async function getRobotsPolicy() {
  if (robotsCache && Date.now() - robotsCache.checkedAt < 60 * 60 * 1000) return robotsCache;
  const response = await fetch('https://cpplusworld.com/robots.txt', { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Could not check official robots.txt (HTTP ${response.status}). Lookup stopped.`);
  const text = await response.text();
  const blocked = text.split(/\r?\n/).some((line) => /^\s*Disallow:\s*\/products(?:\/|\s|$)/i.test(line));
  if (blocked) throw new Error('Official robots.txt disallows automated product retrieval.');
  robotsCache = { checkedAt: Date.now(), text };
  return robotsCache;
}

async function spacedFetch(url) {
  const run = requestQueue.then(async () => {
    const waitMs = Math.max(0, minimumRequestGapMs - (Date.now() - lastFetchAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastFetchAt = Date.now();
    const response = await fetch(url, {
      redirect: 'follow', signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'VisionTechSolutions product catalogue lookup; contact administrator before enabling bulk use' }
    });
    if (!safeOfficialUrl(response.url, url)) throw new Error('Official source redirected outside the approved CP PLUS domain.');
    return response;
  });
  requestQueue = run.catch(() => {});
  return run;
}

async function catalogue() {
  return JSON.parse(await readFile(cataloguePath, 'utf8'));
}

async function fetchOfficialProduct(modelNumber) {
  await getRobotsPolicy();
  const products = await catalogue();
  const existing = products.find((item) => item.model.toUpperCase() === modelNumber);
  const searchUrl = `https://cpplusworld.com/products/search/${encodeURIComponent(modelNumber)}`;
  const searchResponse = await spacedFetch(searchUrl);
  if (!searchResponse.ok) throw new Error(`Official CP PLUS search returned HTTP ${searchResponse.status}.`);
  const searchHtml = await searchResponse.text();
  const candidates = extractLinks(searchHtml, searchResponse.url).filter((item) => item.label.toUpperCase().includes(modelNumber));
  const modelInHref = candidates.find((item) => item.url.toUpperCase().includes(modelNumber));
  const pageUrl = modelInHref?.url || candidates[0]?.url || null;
  if (!pageUrl) return notFound(modelNumber, existing);
  const pageResponse = await spacedFetch(pageUrl);
  if (!pageResponse.ok) throw new Error(`Official product page returned HTTP ${pageResponse.status}.`);
  const exact = exactProductPage(modelNumber, await pageResponse.text(), pageResponse.url, existing);
  return exact || notFound(modelNumber, existing);
}

function notFound(modelNumber, existing) {
  return {
    id: existing?.id || modelNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    modelNumber, officialName: '', category: existing?.categoryId || null, subcategory: existing?.subcategory || null,
    description: '', features: [], specifications: {}, image: null, gallery: [], datasheet: null,
    sources: { productPage: null, imageSource: null, datasheetSource: null },
    verification: { modelMatched: false, productNameFound: false, specificationsVerified: false, imageVerified: false, datasheetVerified: false, imagePermissionStatus: 'pending', status: 'not-found', verifiedAt: null }
  };
}

function validAdminToken(value) {
  if (!adminToken || !value) return false;
  const expected = createHash('sha256').update(adminToken).digest();
  const received = createHash('sha256').update(value).digest();
  return timingSafeEqual(expected, received);
}

async function approveImport(modelNumber) {
  const preview = previewCache.get(modelNumber);
  if (!preview?.verification.modelMatched || !preview.sources.productPage) throw new Error('No exact official product preview is available to approve. Fetch this exact model again.');
  if (!preview.officialName || !Object.keys(preview.specifications || {}).length) throw new Error('The official page did not provide both a product name and specifications. This incomplete result cannot be imported.');
  const products = await catalogue();
  const index = products.findIndex((item) => item.model.toUpperCase() === modelNumber);
  if (index < 0) throw new Error('This model is not in the existing catalogue. Adding new product records is disabled.');

  const current = products[index];
  const mergedSpecs = { ...current.specifications, ...preview.specifications };
  const imported = {
    ...current,
    officialName: preview.officialName || current.officialName || null,
    modelNumber: current.model,
    name: preview.officialName || current.name,
    description: preview.description || current.description,
    features: preview.features.length ? preview.features : current.features,
    specifications: mergedSpecs,
    image: current.image || null,
    imagePath: current.imagePath || null,
    galleryPaths: current.galleryPaths || [],
    gallery: current.gallery || [],
    datasheet: preview.datasheet?.url && preview.verification.datasheetVerified ? preview.datasheet.url : current.datasheet || null,
    datasheetPath: current.datasheetPath || null,
    datasheetSourceUrl: preview.sources.datasheetSource,
    officialSourceUrls: { productPage: preview.sources.productPage, image: preview.sources.imageSource, datasheet: preview.sources.datasheetSource },
    sources: { ...(current.sources || {}), officialProductPage: preview.sources.productPage, officialImageSource: preview.sources.imageSource, officialDatasheetSource: preview.sources.datasheetSource },
    verificationStatus: 'Official exact model page reviewed by admin; image permission pending',
    imagePermissionStatus: 'pending',
    verification: preview.verification,
    publicationStatus: 'Product information imported; product imagery not approved',
    verifiedOn: preview.verification.verifiedAt
  };
  products[index] = imported;
  const temporaryPath = `${cataloguePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(products, null, 2)}\n`, { encoding: 'utf8', flag: 'w' });
  await rename(temporaryPath, cataloguePath);
  previewCache.delete(modelNumber);
  return imported;
}

function queueApproval(modelNumber) {
  const queued = catalogueWriteQueue.then(() => approveImport(modelNumber));
  catalogueWriteQueue = queued.catch(() => {});
  return queued;
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && origin !== allowedOrigin) return sendJson(response, 403, { error: 'This browser origin is not allowed.' });
  if (request.method === 'OPTIONS') return sendJson(response, 204, {});
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'POST requests only.' });
  try {
    const body = await readJson(request);
    const modelNumber = normalizeModel(body.modelNumber);
    if (request.url === '/api/lookup') {
      const product = await fetchOfficialProduct(modelNumber);
      previewCache.set(modelNumber, product);
      return sendJson(response, 200, { product });
    }
    if (request.url === '/api/approve') {
      if (!validAdminToken(request.headers['x-admin-token'])) return sendJson(response, 401, { error: 'Admin token is missing or invalid. Set CPPLUS_ADMIN_TOKEN when starting the local importer and enter it here.' });
      const product = await queueApproval(modelNumber);
      return sendJson(response, 200, { product });
    }
    return sendJson(response, 404, { error: 'Unknown importer endpoint.' });
  } catch (error) {
    const status = /format is invalid|Request JSON|too large/.test(error.message) ? 400 : /Admin token/.test(error.message) ? 401 : /cannot be imported|not in the existing|No exact/.test(error.message) ? 409 : 502;
    return sendJson(response, status, { error: error.message || 'Official source retrieval failed.' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`CP PLUS importer listening on http://127.0.0.1:${port}`);
  if (!adminToken) console.warn('Approvals are disabled: set CPPLUS_ADMIN_TOKEN in the environment before starting the service.');
});
