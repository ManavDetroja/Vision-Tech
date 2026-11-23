// Public media IDs are supplied by the publication-checked catalogue endpoint.
export function publicProductGalleryPaths(product) {
  return (product?.publishedMedia || []).filter(id=>typeof id==='string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id))
    .map(id=>'/api/public/product-images/'+id);
}
export function publicProductImagePath(product) {
  return publicProductGalleryPaths(product)[0] || '';
}
export function productImageMarkup(product, { className = '', fallback = 'Product image not yet available', assetPrefix = '' } = {}) {
  const path = publicProductImagePath(product);
  const alt = `${product?.officialName || product?.name || 'Security product'} (${product?.model || 'model not supplied'})`;
  const frameClass = ['product-image-frame', className].filter(Boolean).join(' ');
  const src = path ? path : '';
  const metadata = product?.imageAssets?.find((asset) => asset.path === path);
  const width = Number(metadata?.width) > 0 ? Number(metadata.width) : 640;
  const height = Number(metadata?.height) > 0 ? Number(metadata.height) : 480;
  return `<span class="${frameClass}" data-product-image-frame>${src
    ? `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="lazy" decoding="async" width="${width}" height="${height}" data-product-image>`
    : `<span class="product-placeholder" data-product-image-placeholder>${escapeHtml(fallback)}</span>`}</span>`;
}

export function bindProductImageFallbacks(root = document) {
  root.querySelectorAll('[data-product-image]').forEach((image) => {
    const showFallback = () => {
      image.hidden = true;
      const frame = image.closest('[data-product-image-frame]');
      if (!frame) return;
      frame.classList.add('is-unavailable');
      if (!frame.querySelector('[data-product-image-placeholder]')) {
        const placeholder = document.createElement('span');
        placeholder.className = 'product-placeholder';
        placeholder.dataset.productImagePlaceholder = '';
        placeholder.textContent = 'Product image unavailable';
        frame.append(placeholder);
      }
    };
    image.addEventListener('error', showFallback, { once: true });
    if (image.complete && image.naturalWidth === 0) showFallback();
  });
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function escapeAttribute(value = '') {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
