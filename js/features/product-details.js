import { categories } from '../data/categories.js';
import { products } from '../data/products.js';

const target = document.querySelector('#product-detail');
const requestedModel = new URLSearchParams(window.location.search).get('model');
const product = products.find((item) => item.model.toLowerCase() === (requestedModel || '').toLowerCase());

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function displayValue(value) {
  if (Array.isArray(value)) return value.map(displayValue).join(', ');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}: ${displayValue(item)}`).join('; ');
  return String(value ?? '');
}

function specificationRows(item) {
  const rows = [['Exact model number', item.model, 'Catalogue record']];

  if (item.resolutionMp !== null && item.resolutionMp !== undefined) {
    rows.push(['Resolution (supplied)', `${item.resolutionMp} MP`, 'Not yet verified']);
  }

  for (const [key, value] of Object.entries(item.specifications || {})) {
    const label = key === 'channels' ? 'Supplied channel information' : key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
    rows.push([label, displayValue(value), 'Not yet verified']);
  }

  if (item.sourceInformation) {
    rows.push(['Original source label', item.sourceInformation, 'Meaning not yet verified']);
  }

  return rows;
}

function renderNotFound() {
  document.title = 'Product Not Found | VisionTech Solutions™';
  target.innerHTML = `
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="index.html">Home</a><span aria-hidden="true">/</span><a href="products.html">Products</a><span aria-hidden="true">/</span><span>Not found</span>
    </nav>
    <div class="empty-state detail-error">
      <span class="detail-status">Catalogue lookup</span>
      <h1>Product not found</h1>
      <p>No product in the current catalogue matches that model number.</p>
      <a class="button button-primary" href="products.html">Back to catalogue</a>
    </div>`;
}

function renderProduct(item) {
  const category = categories.find((entry) => entry.id === item.categoryId);
  if (!category) return renderNotFound();

  const relatedProducts = products.filter((entry) => entry.categoryId === item.categoryId && entry.id !== item.id);
  const rows = specificationRows(item);
  const features = Array.isArray(item.features) ? item.features.filter(Boolean) : [];
  const isVerified = item.verification?.status === 'verified';
  const name = item.officialName || item.name || `Model ${item.model}`;
  const description = item.description?.trim() || 'A model-specific description is not yet verified for this product.';
  const imagePath = item.imagePath || (typeof item.image === 'string' ? item.image : item.image?.localPath);
  const imageMarkup = imagePath
    ? `<img class="detail-product-image" src="${escapeHtml(imagePath)}" alt="${escapeHtml(name)}" loading="lazy">`
    : `<span class="product-placeholder">${escapeHtml(category.name)} · image pending</span>`;

  document.title = `${name} | VisionTech Solutions™`;
  target.innerHTML = `
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="index.html">Home</a>
      <span aria-hidden="true">/</span>
      <a href="products.html">Products</a>
      <span aria-hidden="true">/</span>
      <a href="products.html?category=${encodeURIComponent(item.categoryId)}">${escapeHtml(category.name)}</a>
      <span aria-hidden="true">/</span>
      <span aria-current="page">${escapeHtml(item.model)}</span>
    </nav>

    <article class="product-detail-page" aria-labelledby="detail-title">
      <section class="detail-layout">
        <div class="detail-media-column">
          <div class="product-art detail-art" aria-label="Product image area">${imageMarkup}</div>
          <p class="detail-image-note">${imagePath ? 'Product image' : 'Product image not yet available'}</p>
        </div>

        <div class="detail-copy">
          <div class="detail-category-line">
            <span class="badge">${escapeHtml(category.name)}</span>
            ${item.subcategory ? `<span class="detail-subcategory">${escapeHtml(item.subcategory)}</span>` : ''}
          </div>
          <h1 id="detail-title">${escapeHtml(name)}</h1>
          <p class="detail-model"><span>Model number</span><strong>${escapeHtml(item.model)}</strong></p>
          <span class="verification-badge">${isVerified ? 'Product details verified' : 'Product details not yet verified'}</span>
          <p class="detail-description">${escapeHtml(description)}</p>
          <a class="button button-primary detail-enquiry-button" href="contact.html?type=product&amp;model=${encodeURIComponent(item.model)}">
            Enquire About This Product
          </a>
          <p class="detail-enquiry-note">Use the contact form to prepare a product enquiry. Live submission is not configured yet.</p>
        </div>
      </section>

      <div class="detail-content-grid">
        <section class="detail-panel" aria-labelledby="features-title">
          <div class="detail-section-heading">
            <p class="eyebrow">Product information</p>
            <h2 id="features-title">Key features</h2>
          </div>
          ${features.length
            ? `<ul class="detail-feature-list">${features.map((feature) => `<li><span aria-hidden="true">✓</span><span>${escapeHtml(feature)}</span><small>Not yet verified</small></li>`).join('')}</ul>`
            : '<p class="detail-unavailable">Not yet verified. No model-specific features are available in the product record.</p>'}
        </section>

        <section class="detail-panel detail-specifications" aria-labelledby="specifications-title">
          <div class="detail-section-heading">
            <p class="eyebrow">Technical data</p>
            <h2 id="specifications-title">Specifications</h2>
          </div>
          <div class="spec-table-wrap">
            <table class="spec-table">
              <thead><tr><th scope="col">Specification</th><th scope="col">Details</th><th scope="col">Status</th></tr></thead>
              <tbody>${rows.map(([label, value, status]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value || 'Not yet verified')}</td><td><span class="spec-status ${status === 'Catalogue record' ? 'spec-status-record' : ''}">${escapeHtml(status)}</span></td></tr>`).join('')}
              ${rows.length === 1 ? '<tr><th scope="row">Additional specifications</th><td>Not yet verified</td><td><span class="spec-status">Not yet verified</span></td></tr>' : ''}</tbody>
            </table>
          </div>
        </section>

        <section class="detail-panel detail-applications" aria-labelledby="applications-title">
          <div class="detail-section-heading">
            <p class="eyebrow">Planning guidance</p>
            <h2 id="applications-title">Applications &amp; use cases</h2>
          </div>
          <p class="detail-unavailable">Not yet verified. No model-specific application or installation guidance is included in the current product record.</p>
        </section>
      </div>

      <section class="related-products detail-related" aria-labelledby="related-title">
        <div class="detail-section-heading">
          <p class="eyebrow">Explore the catalogue</p>
          <h2 id="related-title">Related ${escapeHtml(category.name)}</h2>
        </div>
        ${relatedProducts.length
          ? `<div class="related-product-grid">${relatedProducts.map((entry) => `
              <a class="related-product-card" href="product-details.html?model=${encodeURIComponent(entry.model)}">
                <span class="related-product-category">${escapeHtml(entry.subcategory || category.name)}</span>
                <strong>${escapeHtml(entry.officialName || entry.name || entry.model)}</strong>
                <span class="related-product-model">${escapeHtml(entry.model)}</span>
                <span class="related-product-link">View product details <span aria-hidden="true">→</span></span>
              </a>`).join('')}</div>`
          : '<p class="detail-unavailable">There are no other products listed in this category yet.</p>'}
      </section>

      <div class="detail-bottom-actions">
        <a class="button button-secondary" href="products.html?category=${encodeURIComponent(item.categoryId)}">Back to ${escapeHtml(category.name)}</a>
        <a class="button button-primary" href="contact.html?type=product&amp;model=${encodeURIComponent(item.model)}">Enquire About This Product</a>
      </div>
    </article>`;

}

if (!product) renderNotFound();
else renderProduct(product);
