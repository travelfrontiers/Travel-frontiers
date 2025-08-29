// Evita redefinição se já existir
if (!customElements.get('tf-promo-card')) {
  class TfPromoCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._data = {};
    }

    set data(item) {
      this._data = item || {};
      this.render();
    }

    get data() {
      return this._data;
    }

    render() {
      const item = this._data || {};
      const themeClass = item.theme ? `theme-${item.theme}` : '';
      const formatClass = item.format ? `format-${item.format}` : '';
      const clickableStart = item.link
        ? `<a class="card ${themeClass} ${formatClass}" href="${item.link}" target="_self" rel="noopener">`
        : `<div class="card ${themeClass} ${formatClass}">`;
      const clickableEnd = item.link ? `</a>` : `</div>`;

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            font-family: var(--tf-font-family-display, sans-serif);
          }
          .card {
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: block;
            color: var(--tf-text-color-white, #fff);
            text-decoration: none;
            position: relative;
          }
          .image { position: relative; line-height: 0; }
          .image img { display: block; width: 100%; height: auto; }
          .badge {
            position: absolute;
            top: 10px;
            left: 10px;
            background-color: var(--tf-color-primary, #e63946);
            color: var(--tf-text-color-white, #fff);
            padding: 0.35rem 0.6rem;
            border-radius: 4px;
            font-weight: 800;
            font-size: 0.8rem;
            letter-spacing: .5px;
            text-transform: uppercase;
          }
          .overlay {
            position: absolute;
            bottom: 0; left: 0; width: 100%;
            padding: var(--tf-gap, 16px);
            background: linear-gradient(to top, rgba(0,0,0,0.65), transparent 60%);
          }
          .title {
            font-size: 1.4rem; margin: 0 0 0.25rem; font-weight: 800; text-transform: uppercase;
          }
          .subtitle, .meta, .includes, .hotel, .provider, .rnvat, .price-note {
            margin: 0.15rem 0; font-size: 0.9rem;
          }
          .price {
            font-size: 1.8rem; font-weight: 800; margin-top: 0.35rem;
            color: var(--tf-color-primary, #e63946);
          }
          .logo {
            position: absolute; bottom: 10px; right: 10px;
            max-width: 80px; height: auto;
          }
        </style>
        ${clickableStart}
          <div class="image">
            <img src="${item['image-src'] || ''}" alt="${item['image-alt'] || ''}">
            ${item['badge-text'] ? `<div class="badge">${item['badge-text']}</div>` : ''}
            <div class="overlay">
              ${item.destination ? `<h3 class="title">${item.destination}</h3>` : ''}
              ${item.subtitle ? `<p class="subtitle">${item.subtitle}</p>` : ''}
              ${(item.origin || item.dates) ? `<p class="meta">${[item.origin, item.dates].filter(Boolean).join(' | ')}</p>` : ''}
              ${item.includes ? `<p class="includes">${item.includes}</p>` : ''}
              ${item.hotel ? `<p class="hotel">${item.hotel}</p>` : ''}
              ${item.provider ? `<p class="provider">${item.provider}</p>` : ''}
              ${item.rnvat ? `<p class="rnvat">${item.rnvat}</p>` : ''}
              ${(item.price || item.currency) ? `<div class="price">${item.price || ''} ${item.currency || ''}</div>` : ''}
              ${item['price-note'] ? `<p class="price-note">${item['price-note']}</p>` : ''}
            </div>
            ${item['logo-src'] ? `<img class="logo" src="${item['logo-src']}" alt="Logo">` : ''}
          </div>
        ${clickableEnd}
      `;
    }
  }

  customElements.define('tf-promo-card', TfPromoCard);
}
