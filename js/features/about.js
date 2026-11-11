import { aboutBusiness, approachSteps, businessAreas, coreValues, reasonsToConsider } from '../data/about.js';
import { renderApproachStep, renderBusinessArea, renderCoreValue, renderReason } from '../components/about-sections.js';

function setText(selector, value, root) {
  const element = root.querySelector(selector);
  if (element) element.textContent = value;
}

function setCollection(selector, items, renderItem, root) {
  const element = root.querySelector(selector);
  if (element) element.innerHTML = items.map(renderItem).join('');
}

export function renderAboutPage(root = document) {
  setText('#about-introduction', aboutBusiness.introduction, root);
  setText('#about-mission', aboutBusiness.mission, root);
  setText('#about-vision', aboutBusiness.vision, root);
  setCollection('#about-business-areas', businessAreas, renderBusinessArea, root);
  setCollection('#about-approach-steps', approachSteps, renderApproachStep, root);
  setCollection('#about-core-values', coreValues, renderCoreValue, root);
  setCollection('#about-reasons', reasonsToConsider, renderReason, root);
}
