export function createModalController(root) {
  if (!root) {
    return {
      open: () => {},
      close: () => {}
    };
  }

  const close = () => {
    root.innerHTML = '';
  };

  const open = ({ title, content }) => {
    root.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div class="modal-header">
            <h2 id="modal-title">${title}</h2>
            <button class="modal-close" type="button" aria-label="Close dialog">×</button>
          </div>
          <div class="modal-content">
            ${content}
          </div>
        </section>
      </div>`;

    root.querySelector('.modal-close').addEventListener('click', close);
    root.querySelector('.modal-backdrop').addEventListener('click', (event) => {
      if (event.target === event.currentTarget) {
        close();
      }
    });
  };

  return { open, close };
}
