// Shared, source-aware catalogue facts. Unverified supplied labels are retained in
// the data record but are never presented as manufacturer-confirmed specifications.
export function productEnquiryUrl(product) {
  return `contact.html?type=product&model=${encodeURIComponent(product.model)}`;
}

export function verifiedProductFacts(product) {
  const verified = new Set(product.verification?.verifiedFields || []);
  const facts = [];
  if (verified.has('resolutionMp') && product.resolutionMp) facts.push(`${product.resolutionMp} MP`);
  if (verified.has('channels') && product.specifications?.channels) facts.push(`${product.specifications.channels} IP channels`);
  if (verified.has('PoE ports') && product.specifications?.['PoE ports']) facts.push(`${product.specifications['PoE ports']} PoE ports`);
  if (verified.has('Maximum Power') && product.specifications?.['Maximum Power']) facts.push(`${product.specifications['Maximum Power']} solar panel`);
  return facts;
}

export function officialSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^(?:www\.|web\.)?cpplusworld\.com$/i.test(url.hostname) ? url.href : '';
  } catch { return ''; }
}
