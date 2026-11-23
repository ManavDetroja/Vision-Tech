import { categories } from '../data/categories.js';
import { products } from '../data/products.js';
import { installationSteps, serviceFaqs, services } from '../data/services.js';
import { publicCollection } from '../data/public-content.js';
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

  try {
    const activeServices = await publicCollection('services', () => services);
    if (overview) overview.innerHTML = activeServices.map(renderServiceCard).join('') || '<p>No published services.</p>';
    if (details) details.innerHTML = activeServices.map((service) => renderServiceDetail(service, categories, products)).join('');
  } catch {
    if (overview) overview.textContent = 'The published services could not be loaded. Refresh to retry.';
  }
  if (process) process.innerHTML = installationSteps.map(renderProcessStep).join('');
  if (faqs) faqs.innerHTML = serviceFaqs.map(renderServiceFaq).join('');
  if (productCategories) productCategories.innerHTML = categories.map(renderProductCategoryLink).join('');
}
