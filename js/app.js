import { renderFooter, renderNavbar } from './components/layout.js';
import { createModalController } from './components/modal.js';
import { renderHomePage } from './features/home.js';
import { initRevealAnimations } from './features/reveal.js';

const siteRoot = document.body.dataset.root || '.';
const currentPage = document.body.dataset.page;

renderNavbar(document.querySelector('#site-header'), {
  root: siteRoot,
  page: currentPage
});

renderFooter(document.querySelector('#site-footer'), {
  root: siteRoot
});

createModalController(document.querySelector('#modal-root'));

if (currentPage === 'home') {
  renderHomePage(document.querySelector('#home-sections'));
}

initRevealAnimations();
