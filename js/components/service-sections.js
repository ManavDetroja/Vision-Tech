function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

const serviceEnquiryTypes = {
  'cctv-installation': 'installation',
  'cctv-repair': 'repair',
  'cctv-maintenance': 'maintenance',
  'cctv-upgrades': 'upgrade',
  'security-consultation': 'general'
};

function serviceEnquiryUrl(service) {
  const type = serviceEnquiryTypes[service.id] || 'general';
  return `contact.html?type=${encodeURIComponent(type)}&amp;service=${encodeURIComponent(service.id)}`;
}

export function renderServiceCard(service) {
  return `
    <a class="service-overview-card" href="#${escapeHtml(service.id)}">
      <span class="service-card-number">${escapeHtml(service.number)}</span>
      <span class="service-card-copy">
        <strong>${escapeHtml(service.title)}</strong>
        <span>${escapeHtml(service.summary)}</span>
      </span>
      <span class="service-card-arrow" aria-hidden="true">↗</span>
    </a>`;
}

export function renderServiceDetail(service, categories, products) {
  const categoryLinks = service.categoryIds
    .map((categoryId) => categories.find((category) => category.id === categoryId))
    .filter(Boolean)
    .map((category) => `
      <a class="service-product-link" href="products.html?category=${encodeURIComponent(category.id)}">
        ${escapeHtml(category.name)} <span aria-hidden="true">→</span>
      </a>`)
    .join('');
  const modelLinks = products
    .filter((product) => service.categoryIds.includes(product.categoryId))
    .map((product) => `
      <a href="product-details.html?model=${encodeURIComponent(product.model)}">${escapeHtml(product.model)}</a>`)
    .join('');

  return `
    <article class="service-detail-card" id="${escapeHtml(service.id)}" aria-labelledby="${escapeHtml(service.id)}-title">
      <div class="service-detail-index" aria-hidden="true">${escapeHtml(service.number)}</div>
      <div class="service-detail-content">
        <p class="eyebrow">CCTV service</p>
        <h3 id="${escapeHtml(service.id)}-title">${escapeHtml(service.title)}</h3>
        <p class="service-detail-description">${escapeHtml(service.description)}</p>
        <h4>Service topics</h4>
        <ul class="service-topic-list">
          ${service.capabilities.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
        <div class="service-product-links" aria-label="Related product categories">
          ${categoryLinks}
        </div>
        <details class="service-model-disclosure">
          <summary>Browse listed models <span aria-hidden="true"></span></summary>
          <div class="service-model-link-list">${modelLinks}</div>
        </details>
        <a class="button button-secondary service-enquiry-link" href="${serviceEnquiryUrl(service)}">Enquire about this service</a>
      </div>
    </article>`;
}

export function renderProcessStep(step) {
  return `
    <li class="process-step">
      <span class="process-step-number">${escapeHtml(step.number)}</span>
      <div>
        <h3>${escapeHtml(step.title)}</h3>
        <p>${escapeHtml(step.description)}</p>
      </div>
    </li>`;
}

export function renderServiceFaq(faq, index) {
  return `
    <details class="service-faq-item"${index === 0 ? ' open' : ''}>
      <summary>${escapeHtml(faq.question)}<span aria-hidden="true"></span></summary>
      <p>${escapeHtml(faq.answer)}</p>
    </details>`;
}

export function renderProductCategoryLink(category) {
  return `
    <a class="service-category-card" href="products.html?category=${encodeURIComponent(category.id)}">
      <span class="service-category-label">Product category</span>
      <strong>${escapeHtml(category.name)}</strong>
      <span class="service-category-description">${escapeHtml(category.description)}</span>
      <span class="service-category-action">Explore products <span aria-hidden="true">→</span></span>
    </a>`;
}
