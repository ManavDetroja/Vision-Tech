const navigationLinks = [
  { id: 'home', label: 'Home', href: 'index.html' },
  { id: 'products', label: 'Products', href: 'products.html' },
  { id: 'services', label: 'Services', href: 'services.html' },
  { id: 'about', label: 'About', href: 'about.html' },
  { id: 'contact', label: 'Contact', href: 'contact.html' }
];

function createSitePath(root, fileName) {
  return `${root}/${fileName}`.replace(/^\.\//, '');
}

function createBrandMarkup(root) {
  const homePath = createSitePath(root, 'index.html');
  const logoPath = createSitePath(root, 'assets/images/logo/visiontech-vt-logo.png');

  return `
    <a class="wordmark" href="${homePath}" aria-label="VisionTech Solutions home">
      <img
        class="brand-logo"
        src="${logoPath}"
        width="61"
        height="48"
        alt="VisionTech Solutions logo"
      >
      <span class="brand-name">
        VisionTech
        <small>Solutions™</small>
      </span>
    </a>`;
}

function createNavigationLinks(root, currentPage) {
  return navigationLinks.map((link) => {
    const currentPageAttribute = link.id === currentPage ? ' aria-current="page"' : '';

    return `
      <li>
        <a href="${createSitePath(root, link.href)}"${currentPageAttribute}>
          ${link.label}
        </a>
      </li>`;
  }).join('');
}

function closeMobileMenu(menu, toggleButton) {
  menu.classList.remove('is-open');
  toggleButton.setAttribute('aria-expanded', 'false');
}

export function renderNavbar(target, { root = '.', page } = {}) {
  if (!target) {
    return;
  }

  target.className = 'site-header';
  target.innerHTML = `
    <nav class="nav container" aria-label="Primary navigation">
      ${createBrandMarkup(root)}

      <button
        class="nav-toggle"
        type="button"
        aria-expanded="false"
        aria-controls="primary-menu"
      >
        <span class="visually-hidden">Toggle menu</span>
        ☰
      </button>

      <ul class="nav-links" id="primary-menu">
        ${createNavigationLinks(root, page)}
      </ul>
    </nav>`;

  const toggleButton = target.querySelector('.nav-toggle');
  const menu = target.querySelector('.nav-links');

  toggleButton.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    toggleButton.setAttribute('aria-expanded', String(isOpen));
  });

  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      closeMobileMenu(menu, toggleButton);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    closeMobileMenu(menu, toggleButton);
    toggleButton.focus();
  });
}

export function renderFooter(target, { root = '.' } = {}) {
  if (!target) {
    return;
  }

  target.className = 'site-footer';
  target.innerHTML = `
    <div class="container footer-grid">
      <div class="footer-brand">
        ${createBrandMarkup(root)}
        <p>SMART SECURITY. TRUSTED SOLUTIONS.</p>
      </div>

      <nav aria-label="Footer navigation">
        <h2>Explore</h2>
        <a href="${createSitePath(root, 'index.html')}">Home</a>
        <a href="${createSitePath(root, 'products.html')}">Products</a>
        <a href="${createSitePath(root, 'about.html')}">About</a>
        <a href="${createSitePath(root, 'contact.html')}">Contact</a>
      </nav>

      <nav aria-label="Footer services">
        <h2>Services</h2>
        <a href="${createSitePath(root, 'services.html')}">CCTV Camera Sales</a>
        <a href="${createSitePath(root, 'services.html')}">Professional Installation</a>
        <a href="${createSitePath(root, 'services.html')}">CCTV Servicing</a>
        <a href="${createSitePath(root, 'services.html')}">Maintenance &amp; Support</a>
      </nav>
    </div>

    <div class="container footer-bottom">
      <p>© ${new Date().getFullYear()} VisionTech Solutions™</p>
      <p>SMART SECURITY. TRUSTED SOLUTIONS.</p>
    </div>`;
}
