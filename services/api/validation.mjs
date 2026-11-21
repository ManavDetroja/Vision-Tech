import { enquiryTypes } from './constants.mjs';

export function validateEnquiry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return ['Enter a valid enquiry.'];
  const names = ['name', 'email', 'phone', 'enquiryType', 'productModel', 'serviceRequirement', 'message', 'website'];
  if (names.some((key) => body[key] !== undefined && typeof body[key] !== 'string')) {
    return ['Enquiry fields must contain text.'];
  }
  const text = (key) => (body[key] || '').normalize('NFC').trim();
  const name = text('name'); const email = text('email').toLowerCase();
  const rawPhone = text('phone'); const phone = rawPhone.replace(/[ ().-]/g, '');
  const type = text('enquiryType'); const model = text('productModel');
  const service = text('serviceRequirement'); const message = text('message'); const errors = [];
  if (names.some((key) => /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text(key)))) {
    errors.push('Use plain text without markup or control characters.');
  }
  if (name.length < 2 || name.length > 100) errors.push('Enter a name between 2 and 100 characters.');
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) errors.push('Enter a valid email address or leave it blank.');
  if (rawPhone.length > 20 || !/^\+?\d{7,15}$/.test(phone)
    || (rawPhone.match(/\(/g) || []).length !== (rawPhone.match(/\)/g) || []).length) errors.push('Enter a valid phone number with 7 to 15 digits.');
  if (!enquiryTypes.has(type)) errors.push('Choose a valid enquiry type.');
  if (model.length > 100 || (model && !/^[A-Za-z0-9][A-Za-z0-9._ /()-]*$/.test(model))) errors.push('Enter a valid product model.');
  if (service.length > 180) errors.push('Keep the service requirement under 180 characters.');
  if (message.length < 20 || message.length > 2000) errors.push('Enter a message between 20 and 2000 characters.');
  if (body.consent !== true) errors.push('Consent is required.');
  if (text('website')) errors.push('Submission rejected.');
  if (['installation', 'repair', 'maintenance', 'upgrade'].includes(type) && !service) errors.push('Describe the service requirement.');
  return errors.length ? errors : { name, email, phone, enquiryType: type, productModel: model,
    serviceRequirement: service, message, consent: true, website: '' };
}
