import { categories } from '../data/categories.js';
import { products, catalogueUnavailable } from '../data/products.js';
import { bindProductImageFallbacks, productImageMarkup, publicProductGalleryPaths, publicProductImagePath } from '../components/product-image.js';
import { officialSourceUrl, productEnquiryUrl } from '../components/product-content.js';
import { ENQUIRY_API_URL, PUBLIC_API_BASE_URL } from '../data/contact-config.js';

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

  if (item.resolutionMp !== null && item.resolutionMp !== undefined && !item.verification?.verifiedFields?.includes('resolutionMp')) {
    rows.push(['Resolution (supplied)', `${item.resolutionMp} MP`, 'Not yet verified']);
  }

  for (const [key, value] of Object.entries(item.specifications || {})) {
    const label = key === 'channels' ? 'IP camera input channels' : key;
    const evidence = item.specificationEvidence?.[key];
    const verified = value !== null && evidence?.status === 'verified' && officialSourceUrl(evidence.sourceUrl);
    rows.push([label, verified ? displayValue(value) : 'Not yet verified', verified ? (evidence.sourceUrl.endsWith('.pdf') ? 'Official datasheet' : 'Official page') : 'Needs confirmation']);
  }

  return rows;
}

function setProductMetadata(item, name, description) {
  document.title = item.seoTitle || `${item.model} — ${name} | VisionTech Solutions™`;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'description';
    document.head.append(meta);
  }
  meta.content = item.seoDescription || `${item.model}: ${description}`;
  // Domain comes from the existing CNAME; never canonicalize localhost previews.
  const canonicalUrl = new URL('product-details.html', 'https://visiontechsolutionmorbi.in/');
  canonicalUrl.searchParams.set('model', item.model);
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.append(canonical);
  }
  canonical.href = canonicalUrl.href;
  document.querySelector('#product-structured-data')?.remove();
  if (item.verification?.status !== 'verified') return;
  const data = {
    '@context': 'https://schema.org', '@type': 'Product', name,
    model: item.model, brand: { '@type': 'Brand', name: item.brand || 'CP PLUS' },
    description, url: canonicalUrl.href
  };
  const image = publicProductImagePath(item);
  if (image) data.image = new URL(image, canonicalUrl.origin).href;
  const script = document.createElement('script');
  script.id = 'product-structured-data';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.append(script);
}

function productGalleryMarkup(item) {
  const paths = publicProductGalleryPaths(item);
  if (!paths.length) {
    const category = categories.find((entry) => entry.id === item.categoryId);
    return productImageMarkup(item, { fallback: `${category?.name || 'Security product'} · image pending` });
  }

  const model = escapeHtml(item.model);
  const thumbnailMarkup = paths.length > 1
    ? `<div class="product-gallery-thumbnails" role="group" aria-label="Product image choices">${paths.map((path, index) => `
        <button class="product-gallery-thumbnail${index === 0 ? ' is-active' : ''}" type="button" data-gallery-thumbnail data-gallery-path="${escapeHtml(path)}" aria-label="Show product image ${index + 1} of ${paths.length}" aria-pressed="${index === 0}">
          <img src="${escapeHtml(path)}" alt="" width="64" height="84" loading="lazy" decoding="async">
        </button>`).join('')}
      </div>`
    : '';

  return `<div class="product-gallery" data-product-gallery data-model="${model}">
    <div class="product-gallery-stage">
      <button class="product-gallery-open" type="button" data-gallery-open aria-label="Open larger product image for ${model}">
        <img class="product-gallery-main-image" src="${escapeHtml(paths[0])}" alt="${model} product image 1 of ${paths.length}" width="400" height="520" decoding="async" fetchpriority="high" data-gallery-main>
      </button>
      <span class="product-gallery-fallback" data-gallery-fallback hidden>Product image unavailable</span>
      ${paths.length > 1 ? `<button class="product-gallery-nav is-previous" type="button" data-gallery-previous aria-label="Previous product image">‹</button><button class="product-gallery-nav is-next" type="button" data-gallery-next aria-label="Next product image">›</button>` : ''}
      <span class="product-gallery-zoom-hint" aria-hidden="true">Open larger image</span>
    </div>
    ${thumbnailMarkup}
    <dialog class="product-gallery-dialog" data-gallery-dialog aria-label="Product image viewer for ${model}">
      <div class="product-gallery-dialog-panel">
        <button class="product-gallery-close" type="button" data-gallery-close aria-label="Close image viewer">×</button>
        <div class="product-gallery-dialog-stage">
          <button class="product-gallery-nav is-previous" type="button" data-dialog-previous aria-label="Previous product image">‹</button>
          <img class="product-gallery-dialog-image" src="${escapeHtml(paths[0])}" alt="${model} product image 1 of ${paths.length}" width="400" height="520" data-gallery-dialog-image>
          <button class="product-gallery-nav is-next" type="button" data-dialog-next aria-label="Next product image">›</button>
        </div>
        <p class="product-gallery-dialog-count" data-gallery-count>Image 1 of ${paths.length}</p>
      </div>
    </dialog>
  </div>`;
}

function bindProductGallery(root) {
  const gallery = root.querySelector('[data-product-gallery]');
  if (!gallery) return;

  const mainImage = gallery.querySelector('[data-gallery-main]');
  const dialogImage = gallery.querySelector('[data-gallery-dialog-image]');
  const openButton = gallery.querySelector('[data-gallery-open]');
  const fallback = gallery.querySelector('[data-gallery-fallback]');
  const dialog = gallery.querySelector('[data-gallery-dialog]');
  const count = gallery.querySelector('[data-gallery-count]');
  let items = [...gallery.querySelectorAll('[data-gallery-thumbnail]')].map((button) => ({
    button,
    path: button.dataset.galleryPath
  }));

  if (!items.length) {
    items = [{ button: null, path: mainImage?.getAttribute('src') || '' }].filter((item) => item.path);
  }

  let currentIndex = 0;
  let requestedPath = items[0]?.path || '';

  function showCurrent(index) {
    if (!items.length) return;
    currentIndex = (index + items.length) % items.length;
    requestedPath = items[currentIndex].path;
    const alt = `${gallery.dataset.model} product image ${currentIndex + 1} of ${items.length}`;
    mainImage.src = requestedPath;
    mainImage.alt = alt;
    mainImage.hidden = false;
    fallback.hidden = true;
    if (dialogImage) {
      dialogImage.src = requestedPath;
      dialogImage.alt = alt;
    }
    if (count) count.textContent = `Image ${currentIndex + 1} of ${items.length}`;
    items.forEach((item, itemIndex) => {
      if (!item.button) return;
      item.button.classList.toggle('is-active', itemIndex === currentIndex);
      item.button.setAttribute('aria-pressed', String(itemIndex === currentIndex));
    });
    gallery.querySelectorAll('[data-gallery-previous], [data-gallery-next], [data-dialog-previous], [data-dialog-next]').forEach((button) => {
      button.hidden = items.length < 2;
    });
    gallery.querySelector('.product-gallery-thumbnails')?.toggleAttribute('hidden', items.length < 2);
  }

  function removeFailedImage(path) {
    const failedIndex = items.findIndex((item) => item.path === path);
    if (failedIndex < 0) return;
    items[failedIndex].button?.remove();
    items.splice(failedIndex, 1);
    if (!items.length) {
      mainImage.hidden = true;
      fallback.hidden = false;
      openButton.disabled = true;
      gallery.querySelectorAll('[data-gallery-previous], [data-gallery-next], [data-dialog-previous], [data-dialog-next]').forEach((button) => { button.hidden = true; });
      gallery.querySelector('.product-gallery-thumbnails')?.setAttribute('hidden', '');
      return;
    }
    showCurrent(Math.min(failedIndex, items.length - 1));
  }

  mainImage.addEventListener('error', () => removeFailedImage(requestedPath));
  dialogImage?.addEventListener('error', () => removeFailedImage(requestedPath));
  gallery.querySelectorAll('[data-gallery-thumbnail] img').forEach((image) => {
    const path = image.closest('[data-gallery-thumbnail]')?.dataset.galleryPath;
    image.addEventListener('error', () => removeFailedImage(path), { once: true });
  });
  gallery.querySelectorAll('[data-gallery-thumbnail]').forEach((button) => {
    button.addEventListener('click', () => showCurrent(items.findIndex((item) => item.button === button)));
  });
  gallery.querySelectorAll('[data-gallery-next], [data-dialog-next]').forEach((button) => {
    button.addEventListener('click', () => showCurrent(currentIndex + 1));
  });
  gallery.querySelectorAll('[data-gallery-previous], [data-dialog-previous]').forEach((button) => {
    button.addEventListener('click', () => showCurrent(currentIndex - 1));
  });
  openButton.addEventListener('click', () => {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    gallery.querySelector('[data-gallery-close]')?.focus();
  });
  gallery.querySelector('[data-gallery-close]')?.addEventListener('click', () => {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    openButton.focus();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      showCurrent(currentIndex + 1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showCurrent(currentIndex - 1);
    }
  });
  showCurrent(0);
}

function renderNotFound() {
  document.title = 'Product Not Found | VisionTech Solutions™';
  const robots = document.createElement('meta');
  robots.name = 'robots';
  robots.content = 'noindex';
  document.head.append(robots);
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
  const isVerified = item.verification?.status === 'verified';
  const features = (isVerified || item.featureSource) && Array.isArray(item.features) ? item.features.filter(Boolean) : [];
  const name = item.officialName || item.name || `Model ${item.model}`;
  const description = item.description?.trim() || 'A model-specific description is not yet verified for this product.';
  const canDisplayImage = productGalleryMarkup(item);
  const imagePath = publicProductImagePath(item);

  const officialPage = officialSourceUrl(item.officialSourceUrls?.productPage);
  const datasheet = officialSourceUrl(item.datasheetSourceUrl);
  const sourceNotes = (item.researchIssues || []).filter((issue) => item.specifications?.[issue.field] === null);
  setProductMetadata(item, name, description);
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
          <div class="product-art detail-art" aria-label="Product image area">${canDisplayImage}</div>
          <p class="detail-image-note">${imagePath ? 'Product image' : 'Product image not yet available'}</p>
        </div>

        <div class="detail-copy">
          <div class="detail-category-line">
            <span class="badge">${escapeHtml(category.name)}</span>
            ${item.subcategory ? `<span class="detail-subcategory">${escapeHtml(item.subcategory)}</span>` : ''}
          </div>
          <h1 id="detail-title">${escapeHtml(name)}</h1>
          <p class="detail-model"><span>Model number</span><strong>${escapeHtml(item.model)}</strong></p>
          <span class="verification-badge${isVerified ? ' is-verified' : ''}">${isVerified ? 'Official sources reviewed' : 'Product details not yet verified'}</span>
          <p class="detail-description">${escapeHtml(description)}</p>
          <a class="button button-primary detail-enquiry-button" href="${escapeHtml(productEnquiryUrl(item))}">
            Enquire About This Product
          </a>
          <p class="detail-enquiry-note">${ENQUIRY_API_URL || PUBLIC_API_BASE_URL ? 'The contact form will include this exact product model.' : 'Prepare your product enquiry in the contact form. Live submission is not configured yet.'}</p>
          ${officialPage ? `<div class="detail-source-links"><a href="${escapeHtml(officialPage)}" target="_blank" rel="noopener noreferrer">Official product page ↗</a>${datasheet ? `<a href="${escapeHtml(datasheet)}" target="_blank" rel="noopener noreferrer">Manufacturer datasheet ↗</a>` : ''}</div>` : ''}
        </div>
      </section>

      <div class="detail-content-grid">
        <section class="detail-panel" aria-labelledby="features-title">
          <div class="detail-section-heading">
            <p class="eyebrow">Product information</p>
            <h2 id="features-title">Key features</h2>
          </div>
          ${features.length
            ? `<ul class="detail-feature-list">${features.map((feature) => `<li><span aria-hidden="true">✓</span><span>${escapeHtml(feature)}</span><small>Official source</small></li>`).join('')}</ul>`
            : '<p class="detail-unavailable">Not yet verified. No model-specific features are available in the product record.</p>'}
        </section>

        <section class="detail-panel detail-specifications" aria-labelledby="specifications-title">
          <div class="detail-section-heading">
            <p class="eyebrow">Technical data</p>
            <h2 id="specifications-title">Specifications</h2>
          </div>
          <div class="spec-table-wrap" tabindex="0" role="region" aria-label="Product specifications, scroll horizontally if needed">
            <table class="spec-table">
              <caption>Specifications for ${escapeHtml(item.model)}</caption>
              <thead><tr><th scope="col">Specification</th><th scope="col">Details</th><th scope="col">Status</th></tr></thead>
              <tbody>${rows.map(([label, value, status]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value || 'Not yet verified')}</td><td><span class="spec-status ${status === 'Catalogue record' ? 'spec-status-record' : ''}">${escapeHtml(status)}</span></td></tr>`).join('')}
              ${rows.length === 1 ? '<tr><th scope="row">Additional specifications</th><td>Not yet verified</td><td><span class="spec-status">Not yet verified</span></td></tr>' : ''}</tbody>
            </table>
          </div>
          ${sourceNotes.length ? `<details class="detail-source-notes"><summary>Fields awaiting manufacturer clarification</summary><ul>${sourceNotes.map((issue) => `<li><strong>${escapeHtml(issue.field)}:</strong> ${escapeHtml(issue.reason)}</li>`).join('')}</ul></details>` : ''}
          <p class="detail-source-note">${isVerified ? `Official sources reviewed on ${escapeHtml(item.verifiedOn)}. Unavailable or conflicting fields are labelled individually. Warranty terms are not yet verified.` : 'No authoritative technical source for this exact model has been verified. Specifications from similar models are not used.'}</p>
        </section>

        <section class="detail-panel detail-applications" aria-labelledby="applications-title">
          <div class="detail-section-heading">
            <p class="eyebrow">Planning guidance</p>
            <h2 id="applications-title">Applications &amp; use cases</h2>
          </div>
          ${isVerified && item.applications?.length ? `<ul class="detail-feature-list">${item.applications.map((application) => `<li><span aria-hidden="true">✓</span><span>${escapeHtml(application)}</span></li>`).join('')}</ul>` : '<p class="detail-unavailable">Model-specific application guidance is not yet verified. Confirm suitability for your installation before choosing this product.</p>'}
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
                ${productImageMarkup(entry, { className: 'related-product-image-frame', fallback: 'Product image pending' })}
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
  bindProductGallery(target);
  bindProductImageFallbacks(target);

}

if (catalogueUnavailable) target.textContent = 'The published catalogue could not be loaded. Refresh to retry.';
else if (!product) renderNotFound();
else renderProduct(product);
