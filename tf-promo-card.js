// 1. Carregar promoções do JSON e criar os elementos
fetch('promo.json')
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById('promocoes');
    data.forEach(item => {
      const card = document.createElement('tf-promo-card');
      Object.entries(item).forEach(([key, value]) => {
        if (value) card.setAttribute(key, value);
      });
      container.appendChild(card);
    });
  })
  .catch(err => console.error('Erro a carregar promoções:', err));


// 2. Definir o Web Component
class TfPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const format = this.getAttribute('format') || '';
    const imageSrc = this.getAttribute('image-src') || '';
    const imageAlt = this.getAttribute('image-alt') || '';
    const badgeText = this.getAttribute('badge-text') || '';
    const destination = this.getAttribute('destination') || '';
    const subtitle = this.getAttribute('subtitle') || '';
    const origin = this.getAttribute('origin') || '';
    const dates = this.getAttribute('dates') || '';
    const includes = this.getAttribute('includes') || '';
    const hotel = this.getAttribute('hotel') || '';
    const price = this.getAttribute('price') || '';
    const currency = this.getAttribute('currency') || '';
    const logoSrc = this.getAttribute('logo-src') || '';
    const link = this.getAttribute('link') || '#';

    this.shadowRoot.innerHTML = `
      <style>${this.getCss()}</style>
      <div class="card format-${format}">
        <a class="image-link" href="${link}">
          <div class="image">
            <img src="${imageSrc}" alt="${imageAlt}">
            ${badgeText ? `<div class="badge">${badgeText}</div>` : ''}
          </div>
        </a>
        <div class="overlay">
          ${destination ? `<h3 class="title">${destination}</h3>` : ''}
          ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
          ${origin ? `<p class="origin">${origin}</p>` : ''}
          ${dates ? `<p class="dates">${dates}</p>` : ''}
          ${includes ? `<p class="includes">${includes}</p>` : ''}
          ${hotel ? `<p class="hotel">${hotel}</p>` : ''}
          ${price ? `<span class="price">${price}${currency || ''}</span>` : ''}
        </div>
        ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="Logo">` : ''}
      </div>
    `;
  }

  getCss() {
    return `
      :host {
        display: block;
        --tf-font-family-display: 'Montserrat', system-ui, sans-serif;
        --tf-color-primary: #d4a017;
        --tf-text-color-white: #fff;
        --tf-overlay-strength: 0.65;
        font-family: var(--tf-font-family-display, sans-serif);
      }
      .card {
        position: relative;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        background: #000;
      }
      .image-link {
        display: block;
        text-decoration: none;
      }
      .image {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        overflow: hidden;
      }
      .image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .badge {
        position: absolute;
        top: 12px;
        left: 12px;
        background-color: var(--tf-color-primary);
        color: #000;
        padding: 6px 10px;
        border-radius: 4px;
        font-weight: 900;
        font-size: 0.8rem;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        z-index: 3;
      }
      .overlay {
        position: absolute;
        inset: 0;
        padding: 18px 16px;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 6px;
        background: linear-gradient(
          to top,
          rgba(0,0,0,var(--tf-overlay-strength)) 0%,
          rgba(0,0,0,0.3) 45%,
          rgba(0,0,0,0) 75%
        );
        z-index: 2;
      }
      .title {
        margin: 0;
        font-size: 1.6rem;
        font-weight: 900;
        text-transform: uppercase;
        color: #fff;
        text-shadow: 0 2px 8px rgba(0,0,0,0.6);
      }
      .subtitle,
      .origin,
      .dates,
      .includes,
      .hotel {
        margin: 0;
        font-size: 0.95rem;
        color: #fff;
        text-shadow: 0 2px 6px rgba(0,0,0,0.6);
      }
      .price {
        display: inline-block;
        margin-top: 6px;
        font-size: 1.5rem;
        font-weight: 900;
        background: var(--tf-color-primary);
        color: #000;
        padding: 4px 10px;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      }
      .logo {
        position: absolute;
        bottom: 12px;
        right: 12px;
        max-width: 84px;
        height: auto;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
        z-index: 3;
      }
      @media (min-width: 768px) {
        .title { font-size: 1.8rem; }
        .price { font-size: 1.6rem; }
      }
    `;
  }
}

customElements.define('tf-promo-card', TfPromoCard);
