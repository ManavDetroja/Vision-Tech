export function openProductEnquiry(model) {
  const previousDialog = document.querySelector('#product-enquiry-dialog');
  previousDialog?.remove();

  const dialog = document.createElement('dialog');
  dialog.id = 'product-enquiry-dialog';
  dialog.className = 'product-enquiry-dialog';
  dialog.setAttribute('aria-labelledby', 'enquiry-title');
  dialog.innerHTML = `
    <div class="enquiry-dialog-header">
      <div>
        <p class="eyebrow">Product enquiry</p>
        <h2 id="enquiry-title">Tell us what you need</h2>
      </div>
      <button class="enquiry-close" type="button" aria-label="Close enquiry form">×</button>
    </div>
    <p class="enquiry-demo-notice">Demonstration form only. Your details will not be sent or saved because no enquiry service is connected.</p>
    <form class="product-enquiry-form">
      <label for="enquiry-name">Your name <span aria-hidden="true">*</span>
        <input id="enquiry-name" name="name" type="text" autocomplete="name" minlength="2" maxlength="100" required>
      </label>
      <label for="enquiry-email">Email address <span aria-hidden="true">*</span>
        <input id="enquiry-email" name="email" type="email" autocomplete="email" maxlength="254" required>
      </label>
      <label for="enquiry-phone">Phone number <span aria-hidden="true">*</span>
        <input id="enquiry-phone" name="phone" type="tel" autocomplete="tel" pattern="[+]?[0-9() .-]{7,20}" title="Enter 7 to 20 characters using digits, spaces, +, parentheses, dots or hyphens." required>
      </label>
      <label for="enquiry-model">Product model
        <input id="enquiry-model" name="model" type="text" readonly>
      </label>
      <label class="enquiry-message-field" for="enquiry-message">How can we help? <span aria-hidden="true">*</span>
        <textarea id="enquiry-message" name="message" rows="4" minlength="10" maxlength="1000" required></textarea>
      </label>
      <p class="enquiry-feedback" role="status" aria-live="polite"></p>
      <div class="enquiry-form-actions">
        <button class="button button-primary" type="submit">Validate enquiry (demo)</button>
        <button class="button button-secondary enquiry-cancel" type="button">Cancel</button>
      </div>
    </form>`;

  document.body.append(dialog);
  dialog.querySelector('#enquiry-model').value = model;
  const closeDialog = () => dialog.close();
  dialog.querySelector('.enquiry-close').addEventListener('click', closeDialog);
  dialog.querySelector('.enquiry-cancel').addEventListener('click', closeDialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    dialog.querySelector('.enquiry-feedback').textContent = 'Validation passed. This is a demonstration only: no enquiry was sent or saved.';
    form.reset();
    dialog.querySelector('#enquiry-model').value = model;
  });

  dialog.showModal();
  dialog.querySelector('#enquiry-name').focus();
}
