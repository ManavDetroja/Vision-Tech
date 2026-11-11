function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function renderBusinessArea(area) {
  return `
    <article class="about-area-card" data-reveal>
      <span class="about-area-number">${escapeHtml(area.number)}</span>
      <div class="about-area-copy">
        <h3>${escapeHtml(area.title)}</h3>
        <p>${escapeHtml(area.description)}</p>
      </div>
      <a href="${escapeHtml(area.href)}" aria-label="${escapeHtml(area.linkLabel)}: ${escapeHtml(area.title)}">
        ${escapeHtml(area.linkLabel)} <span aria-hidden="true">→</span>
      </a>
    </article>`;
}

export function renderApproachStep(step) {
  return `
    <li class="about-approach-step" data-reveal>
      <span class="about-approach-number">${escapeHtml(step.number)}</span>
      <div><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.description)}</p></div>
    </li>`;
}

export function renderCoreValue(value, index) {
  return `
    <article class="about-value-card" data-reveal>
      <span class="about-value-mark" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <h3>${escapeHtml(value.title)}</h3>
      <p>${escapeHtml(value.description)}</p>
    </article>`;
}

export function renderReason(reason, index) {
  return `
    <article class="about-reason-item" data-reveal>
      <span aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <div><h3>${escapeHtml(reason.title)}</h3><p>${escapeHtml(reason.description)}</p></div>
    </article>`;
}
