// The static JSON remains the local default. A configured secure API keeps admin edits in sync.
import { PUBLIC_API_BASE_URL } from './contact-config.js';

let loadedProducts;
if (PUBLIC_API_BASE_URL) {
  try {
    const response = await fetch(`${PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/api/public/products`, { cache: 'no-store' });
    const result = response.ok ? await response.json() : null;
    if (Array.isArray(result?.products)) loadedProducts = result.products;
  } catch { /* Retain the supplied static catalogue if the optional admin API is unavailable. */ }
}

if (!loadedProducts) {
  const catalogueUrl = new URL('./products.json', import.meta.url);
  const response = await fetch(catalogueUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Catalogue data could not be loaded (${response.status}).`);
  loadedProducts = await response.json();
}

export const products = loadedProducts;
