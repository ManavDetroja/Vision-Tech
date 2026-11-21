export function bindPasswordControls(root = document) {
  root.querySelectorAll('[data-password-toggle]').forEach((button) => {
    const input = root.querySelector(`#${button.dataset.passwordToggle}`);
    button.addEventListener('click', () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.textContent = visible ? 'Hide password' : 'Show password';
      button.setAttribute('aria-pressed', String(visible));
    });
  });
}
