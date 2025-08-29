class TfPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set data(item) {
    this.render(item);
  }

  render(item) {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --tf-color-primary: #d4af37; /* dourado */
          --tf-color-primary-rgb: 212, 175, 55;
          --tf-gap: 1rem;
          --tf-text-color-white: #fff;
          display: block;
          font-family: sans-serif;
        }

        .card {
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .image {
          position: relative;
          line-height: 0;
        }

        .image img {
          display: block;
          width: 100%;
          height: auto;
        }

        .badge {
          position: absolute;
          top: 10px;
          left: 10px;
          background-color: var(--tf-color-primary);
          color: var(--tf-text-color-white);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-weight: bold;
          font-size: 0.85rem;
        }

        .overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          padding: var(--tf-gap);
          color: var(--tf-text-color-white);
          background: linear-gradient(to top, rgba(0,0,0,0.6), transparent 60%);
          width: 100%;
        }

        .overlay .title {
          font-size: 1.25rem;
          margin: 0 0 0.25rem;
          font-weight: bold;
        }

        .overlay .subtitle,
        .overlay .meta,
        .overlay .includes,
        .overlay .hotel,
        .overlay .price-note {
          margin: 0.1rem 0;
          font-size: 0.9rem;
        }

        .overlay .price {
          font-size: 1.2rem;
          font-weight: bold;
          margin-top: 0.25rem;
          color: var(--tf-color-primary);
        }

        .logo {
          position: absolute;
          bottom: 10px;
          right: 10px;
          max-width: 80px;
          height: auto;
        }
      </style>

      <div class="card">
        <div class="image">
          <img src="${item['image-src']}" alt="${item['image-alt'] || ''}">
          ${item['badge-text'] ? `<div class="badge">${item['badge-text']}</div>` : ''}
          <div class="overlay">
            ${item.destination ? `<h3 class="title">${item.destination}</h3>` : ''}
            ${item.subtitle ? `<p class="subtitle">${item.subtitle}</p>` : ''}
            ${(item.origin || item.dates) ? `<p class="meta">${[item.origin, item.dates].filter(Boolean).join(' | ')}</p>` : ''}
            ${item.includes ? `<p class="includes">${item.includes}</p>` : ''}
            ${item.hotel ? `<p class="hotel">${item.hotel}</p>` : ''}
            ${item.price ? `<div class="price">${item.price} ${item.currency || ''}</div>` : ''}
            ${item['price-note'] ? `<p class="price-note">${item['price-note']}</p>` : ''}
          </div>
          ${item['logo-src'] ? `<img class="logo" src="${item['logo-src']}" alt="Logo">` : ''}
        </div>
      </div>
    `;
  }
}

customElements.define('tf-promo-card', TfPromoCard);
