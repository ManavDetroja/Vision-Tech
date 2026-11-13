import { categories } from '../data/categories.js';
import { products } from '../data/products.js';
import { bindProductImageFallbacks, productImageMarkup } from '../components/product-image.js';

const controls = document.querySelector('#catalogue-controls');
const grid = document.querySelector('#product-grid');
const count = document.querySelector('#result-count');
const parameters = new URLSearchParams(window.location.search);
const state = {
  query: '',
  category: parameters.get('category') || '',
  subcategory: '',
  resolution: '',
  sort: 'default'
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function categoryFor(product) {
  return categories.find((category) => category.id === product.categoryId);
}

function renderControls() {
  controls.innerHTML = `
    <div class="catalogue-controls">
      <div class="search-field">
        <label for="product-search">Search products</label>
        <div class="search-input-wrap">
          <input id="product-search" type="search" placeholder="Search model, category or subcategory" value="${escapeHtml(state.query)}">
          <button class="clear-search" type="button" aria-label="Clear search">Clear</button>
        </div>
      </div>
      <label>Category
        <select id="category-filter">
          <option value="">All categories</option>
          ${categories.map((category) => `<option value="${category.id}" ${state.category === category.id ? 'selected' : ''}>${category.name}</option>`).join('')}
        </select>
      </label>
      <label>Subcategory
        <select id="subcategory-filter"><option value="">All subcategories</option></select>
      </label>
      <label>Resolution
        <select id="resolution-filter"><option value="">All resolutions</option>${[2, 3, 4, 6].map((value) => `<option value="${value}" ${state.resolution === String(value) ? 'selected' : ''}>${value} MP</option>`).join('')}</select>
      </label>
      <label>Sort by
        <select id="sort-filter">
          <option value="default">Default order</option>
          <option value="az">Model number A–Z</option>
          <option value="za">Model number Z–A</option>
          <option value="resolution">Resolution</option>
        </select>
      </label>
      <button class="button button-secondary clear-filters" type="button">Clear all filters</button>
    </div>`;

  controls.querySelector('#product-search').addEventListener('input', (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderProducts();
  });
  controls.querySelector('.clear-search').addEventListener('click', () => {
    state.query = '';
    controls.querySelector('#product-search').value = '';
    renderProducts();
  });
  controls.querySelector('#category-filter').addEventListener('change', (event) => {
    state.category = event.target.value;
    state.subcategory = '';
    renderSubcategoryOptions();
    renderProducts();
  });
  controls.querySelector('#subcategory-filter').addEventListener('change', (event) => {
    state.subcategory = event.target.value;
    renderProducts();
  });
  controls.querySelector('#resolution-filter').addEventListener('change', (event) => {
    state.resolution = event.target.value;
    renderProducts();
  });
  controls.querySelector('#sort-filter').addEventListener('change', (event) => {
    state.sort = event.target.value;
    renderProducts();
  });
  controls.querySelector('.clear-filters').addEventListener('click', () => {
    Object.assign(state, { query: '', category: '', subcategory: '', resolution: '', sort: 'default' });
    renderControls();
    renderSubcategoryOptions();
    renderProducts();
  });
  renderSubcategoryOptions();
}

function renderSubcategoryOptions() {
  const select = controls.querySelector('#subcategory-filter');
  const category = categories.find((item) => item.id === state.category);
  const options = category?.subcategories || [];
  select.innerHTML = `<option value="">All subcategories</option>${options.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}`;
  select.disabled = options.length === 0;
}

function filterProducts() {
  const filtered = products.filter((product) => {
    const category = categoryFor(product);
    const searchable = [product.model, product.name, category?.name, product.subcategory].filter(Boolean).join(' ').toLowerCase();
    return (!state.query || searchable.includes(state.query)) &&
      (!state.category || product.categoryId === state.category) &&
      (!state.subcategory || product.subcategory === state.subcategory) &&
      (!state.resolution || product.resolutionMp === Number(state.resolution));
  });

  if (state.sort === 'az') filtered.sort((a, b) => a.model.localeCompare(b.model));
  if (state.sort === 'za') filtered.sort((a, b) => b.model.localeCompare(a.model));
  if (state.sort === 'resolution') filtered.sort((a, b) => (a.resolutionMp || 0) - (b.resolutionMp || 0) || a.model.localeCompare(b.model));
  return filtered;
}

function productCard(product) {
  const category = categoryFor(product);
  const detailUrl = `product-details.html?model=${encodeURIComponent(product.model)}`;
  const suppliedInfo = product.resolutionMp
    ? `<span>${product.resolutionMp} MP</span>`
    : product.specifications.channels
      ? `<span>${product.specifications.channels} CH</span>`
      : product.sourceInformation
        ? `<span class="unverified-info">Source label: ${escapeHtml(product.sourceInformation)} · verify</span>`
        : '';

  return `
    <article class="product-card">
      <a class="product-art" href="${detailUrl}" aria-label="View details for ${escapeHtml(product.model)}">
        ${productImageMarkup(product, { className: 'catalogue-product-image-frame', fallback: `${category?.name || 'Security product'} · image pending` })}
      </a>
      <div class="product-card-body">
        <p class="product-category">${escapeHtml(category?.name || '')}${product.subcategory ? ` / ${escapeHtml(product.subcategory)}` : ''}</p>
        <h2>${escapeHtml(product.name || product.model)}</h2>
        ${product.name ? `<p class="product-model">Model: ${escapeHtml(product.model)}</p>` : ''}
        <div class="product-facts">${suppliedInfo}</div>
        <a class="button button-primary" href="${detailUrl}">View Details</a>
      </div>
    </article>`;
}

function renderProducts() {
  const results = filterProducts();
  count.textContent = `${results.length} of ${products.length} models`;
  grid.innerHTML = results.length
    ? results.map(productCard).join('')
    : '<div class="empty-state"><h2>No matching products</h2><p>Try another model number or clear some filters.</p></div>';
  bindProductImageFallbacks(grid);
}

renderControls();
renderProducts();
