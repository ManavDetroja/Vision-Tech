import { publicCollection } from './public-content.js';
export let catalogueUnavailable = false;
export const products = await publicCollection('products',async()=>{
  const response=await fetch(new URL('./products.json',import.meta.url));
  if(!response.ok) throw new Error('Catalogue unavailable.');
  return response.json();
}).catch(()=>{
  catalogueUnavailable = true;
  return [];
});
