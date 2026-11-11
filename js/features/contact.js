import { products } from '../data/products.js';
import {
  BUSINESS_ADDRESS,
  BUSINESS_EMAIL,
  BUSINESS_HOURS,
  BUSINESS_PHONE,
  ENQUIRY_API_URL,
  GOOGLE_MAPS_URL,
  PUBLIC_API_BASE_URL,
  SHOW_ADDRESS,
  SHOW_BUSINESS_HOURS,
  SHOW_EMAIL,
  SHOW_MAP,
  SHOW_PHONE
} from '../data/contact-config.js';

const enquiryTypes = new Set(['product', 'installation', 'repair', 'maintenance', 'upgrade', 'general']);
const serviceDetails = {
  'cctv-installation': { type: 'installation', label: 'CCTV installation' },
  'cctv-repair': { type: 'repair', label: 'CCTV repair and troubleshooting' },
  'cctv-maintenance': { type: 'maintenance', label: 'CCTV maintenance' },
  'cctv-upgrades': { type: 'upgrade', label: 'CCTV system upgrade' },
  'security-consultation': { type: 'general', label: 'Security consultation' }
};
const fields = [
  ['name', '#contact-name', '#contact-name-error'],
  ['email', '#contact-email', '#contact-email-error'],
  ['phone', '#contact-phone', '#contact-phone-error'],
  ['enquiryType', '#contact-type', '#contact-type-error'],
  ['productModel', '#contact-model', '#contact-model-error'],
  ['serviceRequirement', '#contact-service', '#contact-service-error'],
  ['message', '#contact-message', '#contact-message-error'],
  ['consent', '#contact-consent', '#contact-consent-error']
];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function renderPublicContactDetails(root, published = null) {
  const target = root.querySelector('#public-contact-details');
  if (!target) return;

  const entries = [];
  const email = published ? String(published.email || '').trim() : SHOW_EMAIL ? BUSINESS_EMAIL.trim() : '';
  const phone = published ? String(published.phone || '').trim() : SHOW_PHONE ? BUSINESS_PHONE.trim() : '';
  const address = published ? String(published.address || '').trim() : SHOW_ADDRESS ? BUSINESS_ADDRESS.trim() : '';
  const hours = published ? String(published.businessHours || '').trim() : SHOW_BUSINESS_HOURS ? BUSINESS_HOURS.trim() : '';
  const mapUrl = published ? String(published.mapUrl || '').trim() : SHOW_MAP ? GOOGLE_MAPS_URL.trim() : '';

  if (email) {
    entries.push(`<a class="public-contact-item" href="mailto:${escapeHtml(email)}"><span>Email</span><strong>${escapeHtml(email)}</strong></a>`);
  }
  if (phone) {
    entries.push(`<a class="public-contact-item" href="tel:${escapeHtml(phone)}"><span>Phone</span><strong>${escapeHtml(phone)}</strong></a>`);
  }
  if (address) {
    entries.push(`<div class="public-contact-item"><span>Business address</span><strong>${escapeHtml(address)}</strong></div>`);
  }
  if (hours) {
    entries.push(`<div class="public-contact-item"><span>Business hours</span><strong>${escapeHtml(hours)}</strong></div>`);
  }
  if (/^https:\/\/www\.google\.[^/]+\/maps(?:\/|\?|$)/i.test(mapUrl)) {
    entries.push(`<a class="public-contact-item public-map-link" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer"><span>Google Maps</span><strong>View business location <span aria-hidden="true">↗</span></strong></a>`);
  }

  target.innerHTML = entries.length
    ? entries.join('')
    : '<p class="contact-details-unpublished">Business contact details are not published on this page. You can still prepare an enquiry below; live submission is not configured yet.</p>';
}

function getField(name, root = document) {
  const definition = fields.find(([fieldName]) => fieldName === name);
  return definition ? root.querySelector(definition[1]) : null;
}

function getFieldError(name, root = document) {
  const definition = fields.find(([fieldName]) => fieldName === name);
  return definition ? root.querySelector(definition[2]) : null;
}

function updateServiceRequirement(root) {
  const type = getField('enquiryType', root)?.value;
  const isServiceType = ['installation', 'repair', 'maintenance', 'upgrade'].includes(type);
  const requirement = getField('serviceRequirement', root);
  const mark = root.querySelector('#service-required-mark');
  const help = root.querySelector('#contact-service-help');
  if (!requirement) return;

  requirement.required = isServiceType;
  requirement.setAttribute('aria-required', String(isServiceType));
  if (mark) {
    mark.textContent = isServiceType ? 'Required' : 'Optional';
    mark.classList.toggle('field-required', isServiceType);
    mark.classList.toggle('field-optional', !isServiceType);
  }
  if (help) {
    help.textContent = isServiceType
      ? 'Briefly describe the service or system issue. This field is required for the selected service enquiry.'
      : 'Share the service or system issue you want to discuss.';
  }
}

function prefillFromUrl(root) {
  const parameters = new URLSearchParams(window.location.search);
  const requestedType = parameters.get('type');
  const requestedService = parameters.get('service');
  const type = getField('enquiryType', root);
  const service = getField('serviceRequirement', root);
  const modelInput = getField('productModel', root);
  const requestedModel = parameters.get('model');
  const matchingProduct = products.find((product) => typeof product.model === 'string' && product.model.toLowerCase() === (requestedModel || '').trim().toLowerCase());

  if (matchingProduct && modelInput) {
    modelInput.value = matchingProduct.model;
    if (type) type.value = 'product';
  } else if (type && enquiryTypes.has(requestedType)) {
    type.value = requestedType;
  }

  const serviceDetail = serviceDetails[requestedService];
  if (serviceDetail && service && !requestedModel) {
    service.value = serviceDetail.label;
    if (type && !matchingProduct) type.value = serviceDetail.type;
  }
  updateServiceRequirement(root);
}

function populateProductSuggestions(root) {
  const target = root.querySelector('#contact-product-models');
  if (!target) return;
  target.innerHTML = products.map((product) => `<option value="${escapeHtml(product.model)}"></option>`).join('');
}

function fieldError(name, field) {
  const value = field.type === 'checkbox' ? field.checked : field.value.trim();
  if (field.required && !value) return field.type === 'checkbox' ? 'Please provide your consent to continue.' : 'This field is required.';
  if (name === 'name' && value && value.length < 2) return 'Enter at least 2 characters.';
  if (name === 'email' && value && (field.validity.typeMismatch || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) return 'Enter a valid email address.';
  if (name === 'enquiryType' && value && !enquiryTypes.has(value)) return 'Choose a valid enquiry type.';
  if (name === 'phone' && value) {
    const normalized = value.replace(/[\s().-]/g, '');
    const digits = normalized.replace(/\D/g, '');
    const parenthesesBalanced = (value.match(/\(/g) || []).length === (value.match(/\)/g) || []).length;
    if (!/^\+?\d+$/.test(normalized) || digits.length < 7 || digits.length > 15 || !parenthesesBalanced) return 'Enter a valid phone number with 7 to 15 digits. Include a country code when needed.';
  }
  if (name === 'serviceRequirement' && value.length > 180) return 'Keep the service requirement under 180 characters.';
  if (name === 'message' && value.length < 20) return 'Please provide at least 20 characters so we can understand your enquiry.';
  if (field.maxLength > 0 && value.length > field.maxLength) return `Keep this under ${field.maxLength} characters.`;
  return '';
}

function validateField(name, field, root) {
  const error = fieldError(name, field);
  const errorElement = getFieldError(name, root);
  field.setCustomValidity(error);
  field.setAttribute('aria-invalid', String(Boolean(error)));
  if (errorElement) errorElement.textContent = error;
  return !error;
}

function validateForm(root) {
  let valid = true;
  for (const [name, selector] of fields) {
    const field = root.querySelector(selector);
    if (field && !validateField(name, field, root)) valid = false;
  }
  return valid;
}

function getFormPayload(form) {
  const formData = new FormData(form);
  return {
    name: String(formData.get('name') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    enquiryType: String(formData.get('enquiryType') || ''),
    productModel: String(formData.get('productModel') || '').trim(),
    serviceRequirement: String(formData.get('serviceRequirement') || '').trim(),
    message: String(formData.get('message') || '').trim(),
    consent: formData.get('consent') === 'on',
    website: String(formData.get('website') || '').trim()
  };
}

function bindForm(root, { apiUrl, fetcher }) {
  const form = root.querySelector('#contact-enquiry-form');
  if (!form) return;

  const status = root.querySelector('#contact-form-status');
  const availability = root.querySelector('#submission-availability');
  const submitButton = root.querySelector('#contact-submit');
  let retryFingerprint = '';
  let retryKey = '';
  const endpointConfigured = Boolean(apiUrl.trim());
  if (availability) {
    availability.textContent = endpointConfigured
      ? 'Enquiry submission is connected. Your information will be sent securely to the configured service for processing.'
      : 'Form validation is available, but live enquiry submission is not configured. No enquiry will be sent or saved.';
    availability.classList.toggle('is-configured', endpointConfigured);
  }
  if (submitButton) submitButton.textContent = endpointConfigured ? 'Send enquiry' : 'Check enquiry details';

  fields.forEach(([name, selector]) => {
    const field = root.querySelector(selector);
    field?.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') validateField(name, field, root);
    });
    field?.addEventListener('change', () => {
      if (field.getAttribute('aria-invalid') === 'true') validateField(name, field, root);
      if (name === 'enquiryType') updateServiceRequirement(root);
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (status) {
      status.textContent = '';
      status.className = 'contact-form-status';
    }
    if (!validateForm(root)) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      status.textContent = 'Please review the fields marked below.';
      status.classList.add('is-error');
      return;
    }

    if (!endpointConfigured) {
      status.textContent = 'Your details passed validation, but this website has no enquiry backend configured. Nothing was transmitted or saved. Your entries remain in the form.';
      status.classList.add('is-warning');
      status.focus();
      return;
    }

    const honeypot = root.querySelector('#contact-website');
    if (honeypot?.value) {
      status.textContent = 'The enquiry could not be processed. Please review the form and try again.';
      status.classList.add('is-error');
      status.focus();
      return;
    }

    const originalLabel = submitButton.textContent;
    const payload = getFormPayload(form);
    const fingerprint = JSON.stringify(payload);
    if (!retryKey || fingerprint !== retryFingerprint) {
      retryKey = crypto.randomUUID();
      retryFingerprint = fingerprint;
    }
    submitButton.disabled = true;
    submitButton.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Submitting your enquiry…';
    status.classList.add('is-pending');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetcher(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Idempotency-Key': retryKey },
        body: JSON.stringify(payload),
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'strict-origin-when-cross-origin',
        signal: controller.signal
      });
      let result = {};
      try { result = await response.json(); } catch { /* The configured API must return JSON acceptance. */ }
      if (!response.ok || result.accepted !== true) {
        throw new Error('The configured service did not accept this enquiry.');
      }

      form.reset();
      prefillFromUrl(root);
      retryKey = '';
      retryFingerprint = '';
      status.textContent = 'Your enquiry was accepted for processing by the configured service. This confirms acceptance only, not delivery to a staff member.';
      status.className = 'contact-form-status is-success';
    } catch {
      status.textContent = 'We could not submit your enquiry. Your entries remain in the form; please try again later.';
      status.className = 'contact-form-status is-error';
    } finally {
      clearTimeout(timeout);
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
      form.removeAttribute('aria-busy');
      status.focus();
    }
  });
}

export function renderContactPage(root = document, options = {}) {
  renderPublicContactDetails(root);
  if (PUBLIC_API_BASE_URL) {
    fetch(`${PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/api/public/contact-settings`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((settings) => { if (settings && typeof settings === 'object') renderPublicContactDetails(root, settings); })
      .catch(() => {});
  }
  populateProductSuggestions(root);
  prefillFromUrl(root);
  bindForm(root, {
    apiUrl: options.apiUrl ?? (ENQUIRY_API_URL || (PUBLIC_API_BASE_URL ? `${PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/api/enquiries` : '')),
    fetcher: options.fetcher ?? fetch
  });
}
