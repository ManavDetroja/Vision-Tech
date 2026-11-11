export function loadingState(label = 'Loading…') {
  return `<div class="loading-state" role="status">${label}</div>`;
}

export function emptyState(label = 'Nothing to show yet.') {
  return `<div class="empty-state">${label}</div>`;
}
