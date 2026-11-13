const IMAGE_APPROVED = 'PERMITTED';
const MATCH_VERIFIED = true;

export function publicProductImagePath(product) {
  const path = product?.imagePath || (typeof product?.image === 'string' ? product.image : product?.image?.localPath);
  const reusePermissionApproved = product?.imagePermissionStatus === IMAGE_APPROVED;
  const ownerDirectedPendingRights = product?.imageDisplayApproval === 'OWNER_DIRECTED_RIGHTS_UNCONFIRMED';
  if (!path || (!reusePermissionApproved && !ownerDirectedPendingRights) || product.imageVerificationStatus !== 'VERIFIED' || product.imageModelMatchVerified !== MATCH_VERIFIED) return '';
  const normalized = String(path).replaceAll('\\', '/');
  if (!/^assets\/images\/products\/[a-z0-9-]+\/(?:[A-Za-z0-9-]+\/)?[A-Za-z0-9-]+\.(?:png|jpe?g|webp)$/i.test(normalized)) return '';
  return normalized;
}

export function publicProductGalleryPaths(product) {
  const mainPath = publicProductImagePath(product);
  if (!mainPath) return [];

  const galleryDirectory = `assets/images/products/${product.imageDirectory}/${product.model}/`;
  const galleryPaths = Array.isArray(product.galleryPaths) ? product.galleryPaths : [];
  const safeGalleryPaths = galleryPaths
    .map((path) => String(path || '').replaceAll('\\', '/'))
    .filter((path) => path.startsWith(galleryDirectory)
      && /^assets\/images\/products\/[a-z0-9-]+\/[A-Za-z0-9-]+\/[A-Za-z0-9-]+\.(?:png|jpe?g|webp)$/i.test(path));

  return [...new Set([mainPath, ...safeGalleryPaths])];
}

export function productImageMarkup(product, { className = '', fallback = 'Product image not yet available', assetPrefix = '' } = {}) {
  const path = publicProductImagePath(product);
  const alt = `${product?.officialName || product?.name || 'Security product'} (${product?.model || 'model not supplied'})`;
  const frameClass = ['product-image-frame', className].filter(Boolean).join(' ');
  const src = path ? `${assetPrefix}${path}` : '';
  return `<span class="${frameClass}" data-product-image-frame>${src
    ? `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="lazy" decoding="async" width="640" height="480" data-product-image>`
    : `<span class="product-placeholder" data-product-image-placeholder>${escapeHtml(fallback)}</span>`}</span>`;
}

export function bindProductImageFallbacks(root = document) {
  root.querySelectorAll('[data-product-image]').forEach((image) => {
    image.addEventListener('error', () => {
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
    }, { once: true });
  });
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function escapeAttribute(value = '') {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
