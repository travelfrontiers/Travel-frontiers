class TfPromoCard extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    try {
      this.render();
    } catch (err) {
      console.error('[tf-promo-card] Erro ao renderizar:', err);
    }
  }

  render() {
    const destination = this.getAttribute('destination');
    const subtitle = this.getAttribute('subtitle');
    const origin = this.getAttribute('origin');
    const dates = this.getAttribute('dates');
    const includes = this.getAttribute('includes');
    const hotel = this.getAttribute('hotel');
    const price = this.getAttribute('price');
    const currency = this.getAttribute('currency');
    const imageSrc = this.getAttribute('image-src');
    const logoSrc = this.getAttribute('logo-src');

    this.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          font-family: sans-serif;
          color: #fff;
          overflow: hidden;
        }
        img.bg {
          width: 100%;
          height: auto;
          display: block;
        }
        .overlay {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 20%;
          padding: 0 16px;
          background: linear-gradient(
            to top,
            rgba(0,0,0,0.65) 0%,
            rgba(0,0,0,0.4) 60%,
            rgba(0,0,0,0) 100%
          );
        }
        .title {
          font-size: 2.2rem;
          font-weight: 900;
          margin: 0 0 6px;
          text-transform: uppercase;
          line-height: 1.1;
        }
        .subtitle {
          font-size: 1rem;
          margin: 0 0 4px;
        }
        .meta, .includes, .hotel {
          font-size: 0.9rem;
          margin: 0 0 3px;
        }
        .price {
          display: inline-block;
          margin-top: 8px;
          font-size: 1.4rem;
          font-weight: 800;
          background: var(--tf-color-primary, #ffcc00);
          color: #000;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .logo {
          position: absolute;
          bottom: 8px;
          right: 8px;
          max-height: 40px;
        }
      </style>

      ${imageSrc ? `<img class="bg" src="${imageSrc}" alt="">` : ''}

      <div class="overlay">
        ${destination ? `<h3 class="title">${destination}</h3>` : ''}
        ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
        ${(origin || dates) ? `<p class="meta">${[origin, dates].filter(Boolean).join(' | ')}</p>` : ''}
        ${includes ? `<p class="includes">${includes}</p>` : ''}
        ${hotel ? `<p class="hotel">${hotel}</p>` : ''}
        ${price ? `<span class="price">${price}${currency || ''}</span>` : ''}
      </div>

      ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="Logo">` : ''}
    `;
  }
}

// Proteção contra definição duplicada
if (!customElements.get('tf-promo-card')) {
  customElements.define('tf-promo-card', TfPromoCard);
}
