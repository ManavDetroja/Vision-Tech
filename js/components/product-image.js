const IMAGE_APPROVED = 'PERMITTED';
const MATCH_VERIFIED = true;

// Paths may use the supplied category folders or the separate processed folder.
// Reject absolute URLs, traversal, query strings and encoded path components.
export function safeProductImagePath(value) {
  const path = String(value || '').replaceAll('\\', '/');
  return /^assets\/images\/products\/(?:[a-z0-9_-]+\/){1,4}[a-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(path) ? path : '';
}

export function publicProductImagePath(product) {
  const path = product?.imagePath || (typeof product?.image === 'string' ? product.image : product?.image?.localPath);
  const reusePermissionApproved = product?.imagePermissionStatus === IMAGE_APPROVED;
  const ownerDirectedPendingRights = product?.imageDisplayApproval === 'OWNER_DIRECTED_RIGHTS_UNCONFIRMED';
  if (!path || (!reusePermissionApproved && !ownerDirectedPendingRights) || product.imageVerificationStatus !== 'VERIFIED' || product.imageModelMatchVerified !== MATCH_VERIFIED) return '';
  return safeProductImagePath(path);
}

export function publicProductGalleryPaths(product) {
  const mainPath = publicProductImagePath(product);
  if (!mainPath) return [];

  const galleryPaths = Array.isArray(product.galleryPaths) ? product.galleryPaths : [];
  const safeGalleryPaths = galleryPaths
    .map(safeProductImagePath)
    .filter(Boolean);

  return [...new Set([mainPath, ...safeGalleryPaths])];
}

export function productImageMarkup(product, { className = '', fallback = 'Product image not yet available', assetPrefix = '' } = {}) {
  const path = publicProductImagePath(product);
  const alt = `${product?.officialName || product?.name || 'Security product'} (${product?.model || 'model not supplied'})`;
  const frameClass = ['product-image-frame', className].filter(Boolean).join(' ');
  const src = path ? `${assetPrefix}${path}` : '';
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
