import { categories } from '../data/categories.js';

const iconPaths = {
  camera: '<path d="M4 9h3l2-3h6l2 3h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="14" r="3.5"/>',
  tools: '<path d="m14.7 6.3 3-3a4 4 0 0 1-5 5l-7.4 7.4a2.1 2.1 0 1 1-3-3l7.4-7.4a4 4 0 0 1 5-5l-3 3Z"/><path d="m14 14 5.5 5.5"/>',
  wrench: '<path d="M14.7 6.3a4.5 4.5 0 0 0-5.8 5.8L3 18a2.1 2.1 0 1 0 3 3l5.9-5.9a4.5 4.5 0 0 0 5.8-5.8l-2.9 2.9-3-3 2.9-2.9Z"/>',
  support: '<path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 13v4a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2Zm16 0v4a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z"/><path d="M17 20c0 1-2 2-5 2"/>',
  network: '<circle cx="12" cy="12" r="3"/><path d="M3.5 8.5a12 12 0 0 1 17 0M2 5a15 15 0 0 1 20 0M3.5 15.5a12 12 0 0 0 17 0"/>',
  wifi: '<path d="M3 9a14 14 0 0 1 18 0M6 12a9.5 9.5 0 0 1 12 0M9 15a5 5 0 0 1 6 0"/><circle cx="12" cy="19" r="1"/>',
  signal: '<path d="M5 20h2M9 16h2M13 12h2M17 8h2"/><path d="M3 21V19m4 2v-6m4 6V11m4 10V7m4 14V3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  server: '<rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/><path d="M7 7h.01M7 17h.01"/>',
  switch: '<path d="M4 7h16v10H4z"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h8"/>'
};

const services = [
  {
    icon: 'camera',
    title: 'CCTV Camera Sales',
    description: 'Explore security camera solutions for different monitoring requirements.'
  },
  {
    icon: 'tools',
    title: 'Professional Installation',
    description: 'Installation support for residential and commercial security systems.'
  },
  {
    icon: 'wrench',
    title: 'CCTV Servicing',
    description: 'Assistance with CCTV system inspection and servicing.'
  },
  {
    icon: 'support',
    title: 'Maintenance & Support',
    description: 'Ongoing assistance to help maintain reliable security systems.'
  }
];

const benefits = [
  {
    title: 'Quality security products',
    description: 'A focused selection of CCTV and security solutions for varied needs.'
  },
  {
    title: 'Competitive pricing',
    description: 'Straightforward options designed to suit your security requirements.'
  },
  {
    title: 'Professional installation',
    description: 'Practical installation support for homes, businesses and commercial spaces.'
  },
  {
    title: '18 months of free servicing',
    description: 'Included after installation, subject to applicable service terms.'
  },
  {
    title: 'Ongoing customer support',
    description: 'Continued assistance to help keep your system working reliably.'
  }
];

function createIcon(iconName) {
  return `
    <svg
      class="feature-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      ${iconPaths[iconName]}
    </svg>`;
}

function createServiceCard(service) {
  return `
    <article class="service-card card" data-reveal>
      ${createIcon(service.icon)}
      <h3>${service.title}</h3>
      <p>${service.description}</p>
      <a href="services.html" aria-label="Learn about ${service.title}">
        Learn more <span aria-hidden="true">→</span>
      </a>
    </article>`;
}

function createCategoryCard(category) {
  return `
    <a
      class="category-card card"
      data-reveal
      href="products.html?category=${category.id}"
    >
      <span class="category-icon">
        ${createIcon(category.icon)}
      </span>
      <h3>${category.name}</h3>
      <p>${category.description}</p>
      <span class="category-link">
        Explore category <span aria-hidden="true">→</span>
      </span>
    </a>`;
}

function createBenefitItem(benefit) {
  return `
    <li>
      <span class="benefit-check" aria-hidden="true">✓</span>
      <div>
        <h3>${benefit.title}</h3>
        <p>${benefit.description}</p>
      </div>
    </li>`;
}

export function renderHomePage(target) {
  if (!target) {
    return;
  }

  target.innerHTML = `
    <!-- Commercial hero -->
    <section class="hero" aria-labelledby="hero-title">
      <div class="container hero-grid">
        <div class="hero-copy" data-reveal>
          <p class="eyebrow">SMART SECURITY. TRUSTED SOLUTIONS.</p>
          <p class="hero-brand-name">VisionTech Solutions™</p>
          <h1 id="hero-title">
            Smart CCTV Solutions for <span>Safer Spaces</span>
          </h1>
          <p class="hero-lead">
            Explore dependable CCTV cameras, professional installation and reliable
            security system maintenance for homes, businesses and commercial spaces.
          </p>
          <div class="hero-actions">
            <a class="button button-primary" href="products.html">
              Explore Products <span aria-hidden="true">→</span>
            </a>
            <a class="button button-secondary" href="services.html">
              Discover Our Services
            </a>
          </div>
        </div>

        <div
          class="hero-visual"
          data-reveal
          role="img"
          aria-label="VisionTech Solutions security technology visual"
        >
          <span class="visual-marker visual-marker-one" aria-hidden="true"></span>
          <span class="visual-marker visual-marker-two" aria-hidden="true"></span>
          <img
            class="hero-logo"
            src="assets/images/logo/visiontech-vt-logo.png"
            width="1260"
            height="983"
            alt=""
          >
          <p class="hero-visual-label">SECURITY / INSTALLATION / SUPPORT</p>
        </div>
      </div>
    </section>

    <!-- Service overview -->
    <section class="section services-section" aria-labelledby="services-title">
      <div class="container">
        <div class="section-heading" data-reveal>
          <p class="eyebrow">What we do</p>
          <h2 id="services-title">Security support for every stage.</h2>
          <p>
            From choosing the right CCTV setup through installation, servicing and
            ongoing support.
          </p>
        </div>

        <div class="service-grid">
          ${services.map(createServiceCard).join('')}
        </div>
      </div>
    </section>

    <!-- Product category preview -->
    <section class="section categories-section" aria-labelledby="categories-title">
      <div class="container">
        <div class="section-split" data-reveal>
          <div class="section-heading">
            <p class="eyebrow">Explore equipment</p>
            <h2 id="categories-title">Find the right security foundation.</h2>
          </div>

          <a class="text-link" href="products.html">
            Explore all products <span aria-hidden="true">→</span>
          </a>
        </div>

        <div class="category-grid">
          ${categories.map(createCategoryCard).join('')}
        </div>
      </div>
    </section>

    <!-- Benefits -->
    <section class="section benefits-section" aria-labelledby="benefits-title">
      <div class="container benefits-layout">
        <div class="benefits-visual" data-reveal aria-hidden="true">
          <div class="security-frame">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <div class="shield-mark">✓</div>
          </div>
        </div>

        <div class="benefits-copy" data-reveal>
          <p class="eyebrow">Why VisionTech Solutions™</p>
          <h2 id="benefits-title">Confidence starts with the right support.</h2>
          <p>
            Thoughtful products and practical service help make security decisions clearer.
          </p>

          <ul class="benefit-list">
            ${benefits.map(createBenefitItem).join('')}
          </ul>
        </div>
      </div>
    </section>

    <!-- Business introduction -->
    <section class="section about-preview" aria-labelledby="about-title">
      <div class="container about-layout">
        <div class="about-logo-wrap" data-reveal>
          <img
            src="assets/images/logo/visiontech-vt-logo.png"
            width="1260"
            height="983"
            alt="VisionTech Solutions logo"
          >
        </div>

        <div class="about-copy" data-reveal>
          <p class="eyebrow">VisionTech Solutions™</p>
          <h2 id="about-title">Security Solutions Built Around Your Needs</h2>
          <p>
            VisionTech Solutions™ provides CCTV security products and services designed
            to help homes, businesses and commercial spaces improve their security. Our
            focus includes CCTV camera sales, professional installation, servicing and
            maintenance. We aim to offer dependable security solutions at competitive
            prices, supported by ongoing customer assistance.
          </p>
          <a class="button button-secondary" href="about.html">
            Learn More <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>

    <!-- Final call to action -->
    <section class="section final-cta" aria-labelledby="cta-title">
      <div class="container cta-panel" data-reveal>
        <p class="eyebrow">Start with clarity</p>
        <h2 id="cta-title">Let’s Make Your Space More Secure</h2>
        <p>
          Explore our CCTV solutions and find the right security setup for your requirements.
        </p>
        <a class="button button-primary" href="products.html">
          Browse Products <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>`;
}
