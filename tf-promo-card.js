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
      :host { display: block; font-family: var(--tf-font-family-display, sans-serif); }
      .card {
        position: relative;
        display: block;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        text-decoration: none;
        color: #fff;
      }
      .image {
        aspect-ratio: 16 / 9; /* tamanho acordado */
        overflow: hidden;
        position: relative;
      }
      .image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .badge {
        position: absolute;
        top: 10px;
        left: 10px;
        background: var(--tf-color-primary, #FFD700);
        color: #000;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 800;
        font-size: 0.8rem;
        text-transform: uppercase;
      }
      .overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 16px;
        background: linear-gradient(to top, rgba(0,0,0,0.65), transparent 60%);
      }
      .title {
        font-size: 1.6rem;
        font-weight: 900;
        text-transform: uppercase;
        margin: 0 0 4px;
        color: #fff;
      }
      .price {
        font-size: 1.4rem;
        font-weight: 800;
        background: rgba(255, 215, 0, 0.9);
        color: #000;
        padding: 2px 6px;
        border-radius: 4px;
        display: inline-block;
      }
      .logo {
        position: absolute;
        bottom: 10px;
        right: 10px;
        max-width: 80px;
        height: auto;
      }
    </style>
    ${clickableStart}
      <div class="image">
        <img src="${item['image-src'] || ''}" alt="${item['image-alt'] || ''}">
        ${item['badge-text'] ? `<div class="badge">${item['badge-text']}</div>` : ''}
        <div class="overlay">
          ${item.destination ? `<h3 class="title">${item.destination}</h3>` : ''}
          ${(item.price || item.currency) ? `<div class="price">${item.price || ''} ${item.currency || ''}</div>` : ''}
        </div>
        ${item['logo-src'] ? `<img class="logo" src="${item['logo-src']}" alt="Logo">` : ''}
      </div>
    ${clickableEnd}
  `;
}
  }

  customElements.define('tf-promo-card', TfPromoCard);
}
