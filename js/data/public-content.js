import { PUBLIC_API_BASE_URL } from './contact-config.js';

// A static-only Live Server returns 404 or its HTML shell for /api routes.
export async function publicCollection(key, staticCollection) {
  const response = await fetch(PUBLIC_API_BASE_URL.replace(/\/$/,'')+'/api/public/'+key,{cache:'no-store'});
  const localPreview = !PUBLIC_API_BASE_URL && ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  if(localPreview && (response.status===404 || (response.ok && response.headers.get('content-type')?.includes('text/html'))))return staticCollection();
  if(!response.ok)throw new Error('Published '+key+' are temporarily unavailable.');
  const data=await response.json();
  if(!Array.isArray(data[key]))throw new Error('Invalid published collection.');
  return data[key];
}
