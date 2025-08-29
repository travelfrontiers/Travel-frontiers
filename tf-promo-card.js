// tf-promo-card.js

// 1) Boot: carrega promo.json e injeta cartões no #promocoes
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('promo.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
    const promos = await res.json();

    const container = document.getElementById('promocoes');
    if (!container) throw new Error('Elemento #promocoes não encontrado');

    promos.forEach(item => {
      const card = document.createElement('tf-promo-card');
      // Passa as chaves tal como estão no JSON (com hífen)
      Object.entries(item).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          card.setAttribute(key, String(value));
        }
      });
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Falha ao carregar promoções:', err);
  }
});


// 2) Web Component
if (!customElements.get('tf-promo-card')) {
  class TfPromoCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
      return [
        'format', 'image-src', 'image-alt', 'badge-text', 'destination',
        'subtitle', 'origin', 'dates', 'includes', 'hotel',
        'price', 'currency', 'logo-src', 'link'
      ];
    }

    attributeChangedCallback() {
      // Re-render se atributos mudarem
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      this.render();
    }

    render() {
      // Lê atributos exatamente como no JSON
      const format      = this.getAttribute('format') || 'banner';
      const imageSrc    = this.getAttribute('image-src') || '';
      const imageAlt    = this.getAttribute('image-alt') || '';
      const badgeText   = this.getAttribute('badge-text') || '';
      const destination = this.getAttribute('destination') || '';
      const subtitle    = this.getAttribute('subtitle') || '';
      const origin      = this.getAttribute('origin') || '';
      const dates       = this.getAttribute('dates') || '';
      const includes    = this.getAttribute('includes') || '';
      const hotel       = this.getAttribute('hotel') || '';
      const priceRaw    = this.getAttribute('price') || '';
      const currency    = this.getAttribute('currency') || '';
      const logoSrc     = this.getAttribute('logo-src') || '';
      const link        = this.getAttribute('link') || '#';

      // Evita "290€*€" se o preço já inclui "€"
      const price = currency && !/€/.test(priceRaw) ? `${priceRaw}${currency}` : priceRaw;

      // Anchor só na imagem. Texto NÃO é link.
      const clickableStart = link && link !== '#'
        ? `<a class="image-link" href="${link}" target="_self" rel="noopener">`
        : `<div class="image-link">`;
      const clickableEnd = link && link !== '#' ? `</a>` : `</div>`;

      this.shadowRoot.innerHTML = `
        <style>${this.getCss()}</style>
        <div class="card format-${format}">
          ${clickableStart}
            <div class="image">
              <img src="${imageSrc}" alt="${imageAlt}">
              ${badgeText ? `<div class="badge">${badgeText}</div>` : ''}
            </div>
          ${clickableEnd}

          <div class="overlay">
            ${destination ? `<h3 class="title">${destination}</h3>` : ''}
            ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
            ${(origin || dates) ? `<p class="meta">${[origin, dates].filter(Boolean).join(' — ')}</p>` : ''}
            ${includes ? `<p class="includes">${includes}</p>` : ''}
            ${hotel ? `<p class="hotel">${hotel}</p>` : ''}
            ${price ? `<span class="price">${price}</span>` : ''}
          </div>

          ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="Logo">` : ''}
        </div>
      `;
    }

    getCss() {
      // CSS encapsulado no Shadow DOM — nada do exterior “vaza” para aqui
      return `
        :host {
          display: block;
          --tf-font-family-display: 'Montserrat', system-ui, sans-serif;
          --tf-color-primary: #d4a017; /* amarelo-mostarda */
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

        /* Imagem e formatos (aspect ratio) */
        .image { position: relative; width: 100%; overflow: hidden; line-height: 0; }
        .format-banner .image { aspect-ratio: 16 / 9; }
        .format-square .image { aspect-ratio: 1 / 1; }
        .format-story  .image { aspect-ratio: 9 / 16; }

        .image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .image-link { display: block; text-decoration: none; }

        /* Badge (LAST CALL) */
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

        /* Overlay sobre a imagem com gradiente e texto legível */
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

        /* Tipografia */
        .title {
          margin: 0;
          font-size: 1.6rem;
          font-weight: 900;
          text-transform: uppercase;
          color: #fff;
          text-shadow: 0 2px 8px rgba(0,0,0,0.6);
        }
        .subtitle,
        .meta,
        .includes,
        .hotel {
          margin: 0;
          font-size: 0.95rem;
          color: #fff;
          text-shadow: 0 2px 6px rgba(0,0,0,0.6);
        }
        .meta {
          font-size: 0.9rem;
          opacity: 0.95;
        }

        /* Preço (pill amarelo) */
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

        /* Logo no canto inferior direito */
        .logo {
          position: absolute;
          bottom: 12px;
          right: 12px;
          max-width: 84px;
          height: auto;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
          z-index: 3;
        }

        /* Responsivo */
        @media (min-width: 768px) {
          .title { font-size: 1.8rem; }
          .price { font-size: 1.6rem; }
        }
      `;
    }
  }

  customElements.define('tf-promo-card', TfPromoCard);
}
