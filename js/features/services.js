import { categories } from '../data/categories.js';
import { products } from '../data/products.js';
import { installationSteps, serviceFaqs, services } from '../data/services.js';
import { PUBLIC_API_BASE_URL } from '../data/contact-config.js';
import {
  renderProductCategoryLink,
  renderProcessStep,
  renderServiceCard,
  renderServiceDetail,
  renderServiceFaq
} from '../components/service-sections.js';

export async function renderServicesPage(root = document) {
  const overview = root.querySelector('#service-overview-grid');
  const details = root.querySelector('#service-detail-list');
  const process = root.querySelector('#installation-process');
  const faqs = root.querySelector('#services-faq-list');
  const productCategories = root.querySelector('#service-product-categories');

  let activeServices = services;
  if (PUBLIC_API_BASE_URL) {
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/api/public/services`, { cache: 'no-store' });
      const result = response.ok ? await response.json() : null;
      if (Array.isArray(result?.services)) activeServices = result.services;
    } catch { /* Keep the existing local service content when the optional API is unavailable. */ }
  }

  if (overview) overview.innerHTML = activeServices.map(renderServiceCard).join('');
  if (details) details.innerHTML = activeServices.map((service) => renderServiceDetail(service, categories, products)).join('');
  if (process) process.innerHTML = installationSteps.map(renderProcessStep).join('');
  if (faqs) faqs.innerHTML = serviceFaqs.map(renderServiceFaq).join('');
  if (productCategories) productCategories.innerHTML = categories.map(renderProductCategoryLink).join('');
}
