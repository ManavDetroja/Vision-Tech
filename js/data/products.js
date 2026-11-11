// JSON is the catalogue source of truth so the local importer can safely update it.
// This website is intended to be served over HTTP by VS Code Live Server.
const catalogueUrl = new URL('./products.json', import.meta.url);
const response = await fetch(catalogueUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Catalogue data could not be loaded (${response.status}).`);
export const products = await response.json();
