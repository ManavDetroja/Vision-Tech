import { categories } from '../data/categories.js';

const apiBase = 'http://127.0.0.1:4174/api';
const modelInput = document.querySelector('#model-input');
const adminTokenInput = document.querySelector('#admin-token');
const status = document.querySelector('#import-status');
const results = document.querySelector('#import-results');
const progress = document.querySelector('#batch-progress');
const pauseButton = document.querySelector('#pause-batch');
const fetchAllButton = document.querySelector('#fetch-all');
let models = [];
let pauseRequested = false;
let batchRunning = false;

function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(path === '/approve' ? { 'X-Admin-Token': adminTokenInput.value.trim() } : {}),
      ...options.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Importer service returned ${response.status}.`);
  return body;
}

async function loadModels() {
  const response = await fetch('../js/data/products.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load the existing catalogue (${response.status}).`);
  const products = await response.json();
  models = products.map((product) => product.model);
}

function renderPreview(item) {
  const existing = results.querySelector(`[data-model="${CSS.escape(item.modelNumber)}"]`);
  existing?.remove();
  const categoryLabel = categories.find((category) => category.id === item.category)?.name || 'Existing catalogue category retained';
  const specifications = Object.entries(item.specifications || {});
  const imagePreview = item.image?.url
    ? `<img class="import-product-image" src="${safeText(item.image.url)}" alt="Official image preview for ${safeText(item.modelNumber)}"><p class="permission-note">Preview only. Image reuse permission is pending; it will not be copied or published.</p>`
    : '<div class="import-image-placeholder">Official image unavailable</div>';
  const datasheet = item.datasheet?.url
    ? `<p><strong>Datasheet:</strong> <a href="${safeText(item.datasheet.url)}" target="_blank" rel="noopener noreferrer">${safeText(item.datasheet.label || 'Open official PDF')}</a> <span>(link validation: ${item.verification?.datasheetVerified ? 'model in URL' : 'manual check required'})</span></p>`
    : '<p><strong>Datasheet:</strong> No matching PDF link found.</p>';

  const card = document.createElement('article');
  card.className = 'import-card';
  card.dataset.model = item.modelNumber;
  card.innerHTML = `
    ${imagePreview}
    <div class="import-card-content">
      <span class="verification-badge">${safeText(item.verification?.status || 'needs-verification')}</span>
      <h2>${safeText(item.officialName || item.modelNumber)}</h2>
      <p><strong>Model:</strong> ${safeText(item.modelNumber)}</p>
      <p><strong>Category:</strong> ${safeText(categoryLabel)}${item.subcategory ? ` / ${safeText(item.subcategory)}` : ''}</p>
      <p>${safeText(item.description || 'No official description found.')}</p>
      <h3>Specifications (${specifications.length})</h3>
      ${specifications.length ? `<dl>${specifications.map(([key, value]) => `<div><dt>${safeText(key)}</dt><dd>${safeText(value)}</dd></div>`).join('')}</dl>` : '<p>No specifications extracted.</p>'}
      ${item.features?.length ? `<h3>Official page features</h3><ul>${item.features.map((feature) => `<li>${safeText(feature)}</li>`).join('')}</ul>` : ''}
      ${datasheet}
      <p><a href="${safeText(item.sources?.productPage || '#')}" target="_blank" rel="noopener noreferrer">Official product source</a></p>
      <p><strong>Image permission:</strong> pending</p>
      <div class="import-card-actions">
        <button type="button" class="button button-primary" data-action="approve" ${!item.verification?.modelMatched || !specifications.length || !item.officialName ? 'disabled' : ''}>Approve data and import</button>
        <button type="button" class="button button-secondary" data-action="retry">Retry Fetch</button>
        <button type="button" class="button button-secondary" data-action="reject">Dismiss</button>
      </div>
    </div>`;

  card.querySelector('[data-action="approve"]').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    status.textContent = `Saving the approved official details for ${item.modelNumber}…`;
    try {
      await request('/approve', { method: 'POST', body: JSON.stringify({ modelNumber: item.modelNumber }) });
      status.textContent = `${item.modelNumber} was imported into the catalogue. Refresh public pages to see the update. Product imagery remains unpublished pending permission.`;
      event.currentTarget.textContent = 'Imported';
    } catch (error) {
      event.currentTarget.disabled = false;
      status.textContent = error.message;
    }
  });
  card.querySelector('[data-action="retry"]').addEventListener('click', () => fetchModel(item.modelNumber));
  card.querySelector('[data-action="reject"]').addEventListener('click', () => card.remove());
  results.prepend(card);
}

async function fetchModel(modelNumber) {
  status.textContent = `Searching official CP PLUS sources for ${modelNumber}…`;
  try {
    const result = await request('/lookup', { method: 'POST', body: JSON.stringify({ modelNumber }) });
    renderPreview(result.product);
    status.textContent = result.product.verification.status === 'not-found'
      ? `${modelNumber}: exact match not found. No catalogue change was made.`
      : `${modelNumber}: exact model match found. Review the official source and extracted fields before approval.`;
    return result.product;
  } catch (error) {
    status.textContent = `${modelNumber}: ${error.message}`;
    return null;
  }
}

document.querySelector('#fetch-one').addEventListener('click', () => {
  const modelNumber = modelInput.value.trim();
  if (!modelNumber) { status.textContent = 'Enter a model number first.'; return; }
  fetchModel(modelNumber);
});

fetchAllButton.addEventListener('click', async () => {
  if (batchRunning) return;
  try { if (!models.length) await loadModels(); } catch (error) { status.textContent = error.message; return; }
  batchRunning = true;
  pauseRequested = false;
  fetchAllButton.disabled = true;
  pauseButton.disabled = false;
  pauseButton.textContent = 'Pause batch';
  progress.replaceChildren();
  for (let index = 0; index < models.length; index += 1) {
    while (pauseRequested) await new Promise((resolve) => window.setTimeout(resolve, 250));
    const row = document.createElement('p');
    row.textContent = `${index + 1}/${models.length} · Searching ${models[index]}…`;
    progress.append(row);
    const product = await fetchModel(models[index]);
    row.textContent = `${index + 1}/${models.length} · ${models[index]} · ${product?.verification?.status || 'Fetch failed'} · image ${product?.image?.url ? 'found (permission pending)' : 'not found'} · datasheet ${product?.datasheet?.url ? 'found' : 'not found'}`;
  }
  batchRunning = false;
  pauseButton.disabled = true;
  fetchAllButton.disabled = false;
  status.textContent = `Batch lookup finished for ${models.length} catalogue models. Review and approve eligible records individually.`;
});

pauseButton.addEventListener('click', () => {
  pauseRequested = !pauseRequested;
  pauseButton.textContent = pauseRequested ? 'Resume batch' : 'Pause batch';
});

loadModels().then(() => {
  status.textContent = `Ready to search the official CP PLUS catalogue. ${models.length} models loaded from the existing product data.`;
}).catch((error) => { status.textContent = error.message; });
