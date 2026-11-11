const currentAdminPage = document.body.dataset.adminPage;
const header = document.querySelector('#admin-header');

if (header) {
  header.className = 'admin-header';
  header.innerHTML = `
    <a class="wordmark" href="../index.html" aria-label="Return to VisionTech Solutions website">
      <img
        class="brand-logo"
        src="../assets/images/logo/visiontech-vt-logo.png"
        width="61"
        height="48"
        alt="VisionTech Solutions logo"
      >
      <span class="brand-name">
        VisionTech
        <small>Solutions™</small>
      </span>
    </a>
    <span>Admin / ${currentAdminPage}</span>`;
}
