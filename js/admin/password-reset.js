import { ADMIN_API_BASE_URL } from '../data/admin-config.js';
import { bindPasswordControls } from './password-controls.js';

const form = document.querySelector('#password-reset-form');
const status = document.querySelector('#password-reset-status');
const button = form?.querySelector('button[type="submit"]');
const base = ADMIN_API_BASE_URL.replace(/\/+$/, '');
const query = new URLSearchParams(location.search);
const fragment = new URLSearchParams(location.hash.slice(1));
const code = query.get('code') || '';
const tokenHash = query.get('token_hash') || fragment.get('token_hash') || '';
// Never persist link credentials or legacy implicit access tokens in browser storage.
if (location.search || location.hash) history.replaceState(null, '', location.pathname);
bindPasswordControls();
button.disabled = true;
async function request(path, body) {
  const response = await fetch(`${base}${path}`, { method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000), redirect: 'error', referrerPolicy: 'no-referrer' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed. Try again later.');
  return data;
}
async function prepare() {
  if (!code && !tokenHash) { status.textContent = 'This reset link is missing or invalid. Request a new reset email.'; return; }
  status.textContent = 'Verifying reset link…';
  try {
    const result = await request('/api/auth/password-recovery', code ? { code } : { tokenHash });
    if (result.recoveryReady !== true) throw new Error('The reset link could not be verified.');
    button.disabled = false; status.textContent = 'Link verified. Choose a new password of at least 12 characters.';
  } catch (error) { status.textContent = error.message; }
}
prepare();
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const password = form.elements.password.value;
  if (password !== form.elements.confirmPassword.value) { status.textContent = 'The passwords do not match.'; return; }
  button.disabled = true; form.setAttribute('aria-busy', 'true'); status.textContent = 'Updating password…';
  try {
    const result = await request('/api/auth/password-update', { password });
    if (result.updated !== true) throw new Error('Password update was not confirmed.');
    status.textContent = 'Password updated. Sign in again with your new password.';
    form.reset(); button.hidden = true;
  } catch (error) { status.textContent = error.message; button.disabled = false; }
  finally { form.removeAttribute('aria-busy'); }
});
