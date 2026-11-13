import { ADMIN_API_BASE_URL } from '../data/admin-config.js';

const form = document.querySelector('#password-reset-form');
const status = document.querySelector('#password-reset-status');
const button = form?.querySelector('button[type="submit"]');
const apiBase = ADMIN_API_BASE_URL.replace(/\/+$/, '');
const hash = new URLSearchParams(location.hash.slice(1));
const accessToken = hash.get('access_token') || '';
const tokenType = hash.get('type') || '';

// Remove the recovery token from the address bar and browser history immediately.
if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`);

if (!accessToken || tokenType !== 'recovery') {
  if (status) status.textContent = 'This reset link is missing or invalid. Request a new reset email.';
  if (button) button.disabled = true;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = form.elements.password.value;
  if (password !== form.elements.confirmPassword.value) {
    status.textContent = 'The passwords do not match.';
    return;
  }
  if (password.length < 12 || password.length > 256) {
    status.textContent = 'Choose a password between 12 and 256 characters.';
    return;
  }
  button.disabled = true;
  status.textContent = 'Updating password…';
  try {
    const response = await fetch(`${apiBase}/api/auth/password-update`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, password })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    status.textContent = 'Password updated. You can now sign in with the new password.';
    form.reset();
    button.hidden = true;
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
});
