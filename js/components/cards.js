export function productCard({ name, category, image = '', description = '' }) {
  const imageMarkup = image
    ? `<img src="${image}" alt="" loading="lazy">`
    : '';

  const descriptionMarkup = description
    ? `<p>${description}</p>`
    : '';

  return `
    <article class="card product-card">
      ${imageMarkup}
      <div class="card-content">
        <span class="badge">${category || 'Product'}</span>
        <h3>${name}</h3>
        ${descriptionMarkup}
      </div>
    </article>`;
}

export function categoryCard({ name, description = '', image = '' }) {
  const imageMarkup = image
    ? `<img src="${image}" alt="" loading="lazy">`
    : '';

  const descriptionMarkup = description
    ? `<p>${description}</p>`
    : '';

  return `
    <article class="card category-card">
      ${imageMarkup}
      <div class="card-content">
        <h3>${name}</h3>
        ${descriptionMarkup}
      </div>
    </article>`;
}
