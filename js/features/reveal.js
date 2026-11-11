export function initRevealAnimations() {
  const revealElements = document.querySelectorAll('[data-reveal]');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (
    !revealElements.length ||
    !('IntersectionObserver' in window) ||
    reducedMotionQuery.matches
  ) {
    return;
  }

  document.documentElement.classList.add('js-motion');

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.12
  });

  revealElements.forEach((element) => {
    revealObserver.observe(element);
  });
}
