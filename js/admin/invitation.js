import { ADMIN_API_BASE_URL } from '../data/admin-config.js';
import { bindPasswordControls } from './password-controls.js';

const form = document.querySelector('#invitation-form'), status = document.querySelector('#invitation-status');
const button = form.querySelector('button[type="submit"]');
const tokenHash = new URLSearchParams(location.hash.slice(1)).get('token_hash') || new URLSearchParams(location.search).get('token_hash');
history.replaceState(null, '', location.pathname);
bindPasswordControls();
async function request(path, body) {
  const response = await fetch(`${ADMIN_API_BASE_URL.replace(/\/+$/, '')}${path}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(15000), referrerPolicy: 'no-referrer' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Account setup could not be confirmed. Contact your administrator.');
  return data;
}
async function prepare() {
  if (!tokenHash) { status.textContent = 'This invitation is missing or unsupported. Contact your administrator for a new invitation.'; return; }
  status.textContent = 'Verifying invitation…';
  try {
    const result = await request('/api/auth/invitation-verify', { tokenHash });
    if (result.invitationReady !== true) throw new Error('Invitation verification was not confirmed.');
    button.disabled = false; status.textContent = 'Invitation verified. Choose a password of at least 12 characters.';
  } catch (error) { status.textContent = error.message; }
}
form.addEventListener('submit', async event => {
  event.preventDefault(); if (!form.reportValidity()) return;
  if (form.elements.password.value !== form.elements.confirmPassword.value) { status.textContent = 'The passwords do not match.'; return; }
  button.disabled = true; form.setAttribute('aria-busy', 'true'); status.textContent = 'Completing account setup…';
  try {
    const result = await request('/api/auth/invitation-complete', { password: form.elements.password.value });
    if (result.completed !== true) throw new Error('Account setup was not confirmed.');
    form.reset(); button.hidden = true; status.textContent = 'Account setup complete. Sign in with your work email and new password.';
  } catch (error) { status.textContent = error.message; button.disabled = false; }
  finally { form.removeAttribute('aria-busy'); }
});
prepare();
