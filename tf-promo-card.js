class TfPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._data = {};
  }

  set data(value) {
    this._data = value || {};
    this.render();
  }

  get data() {
    return this._data;
  }

  render() {
    if (!this._data) return;

    const formatClass = `format-${this._data.format || 'banner'}`;
    this.className = '';
    this.classList.add(formatClass);

    const meta = [this._data.origin, this._data.dates].filter(Boolean).join(' | ');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          font-family: var(--tf-font-family-display, sans-serif);
          color: #fff;
          border-radius: 10px;
          overflow: hidden;
        }

        a {
          display: block;
          position: relative;
          color: inherit;
          text-decoration: none;
          height: 100%;
        }

        img.bg {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        /* Story vertical */
        :host(.format-story) {
          max-width: 320px;
          aspect-ratio: 9 / 16;
        }

        /* Banner horizontal */
        :host(.format-banner) img.bg {
          height: 260px;
        }

        .badge {
          position: absolute;
          top: 12px;
          left: 12px;
          background: crimson;
          padding: 4px 10px;
          font-size: 0.8rem;
          font-weight: 800;
          border-radius: 4px;
          z-index: 2;
        }

        .overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 16px;
          background: linear-gradient(to top, rgba(0,0,0,0.75) 30%, rgba(0,0,0,0) 100%);
        }

        .title {
          margin: 0 0 6px;
          font-size: 1.8rem;
          font-weight: 900;
          text-transform: uppercase;
          line-height: 1.1;
        }

        .subtitle {
          margin: 0 0 6px;
          font-size: 1rem;
          font-weight: 500;
        }

        .meta, .includes {
          margin: 0 0 4px;
          font-size: 0.9rem;
          opacity: 0.95;
        }

        .highlight {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
        }

        .hotel {
          font-size: 1rem;
          font-weight: 600;
        }

        .price {
          font-size: 1.2rem;
          font-weight: 900;
          background: var(--tf-color-primary, #ffcc00);
          color: #000;
          padding: 4px 8px;
          border-radius: 6px;
        }

        .logo {
          position: absolute;
          bottom: 12px;
          right: 12px;
          max-height: 40px;
          width: auto;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5));
        }
      </style>

      <a href="${this._data.link || '#'}">
        ${this._data['badge-text'] ? `<span class="badge">${this._data['badge-text']}</span>` : ''}

        ${this._data['image-src'] ? `<img class="bg" src="${this._data['image-src']}" alt="${this._data['image-alt'] || ''}">` : ''}

        <div class="overlay">
          ${this._data.destination ? `<h3 class="title">${this._data.destination}</h3>` : ''}
          ${this._data.subtitle ? `<p class="subtitle">${this._data.subtitle}</p>` : ''}
          ${meta ? `<p class="meta">${meta}</p>` : ''}
          ${this._data.includes ? `<p class="includes">${this._data.includes}</p>` : ''}

          <div class="highlight">
            ${this._data.hotel ? `<span class="hotel">${this._data.hotel}</span>` : ''}
            ${this._data.price ? `<span class="price">${this._data.price}</span>` : ''}
          </div>
        </div>

        ${this._data['logo-src'] ? `<img class="logo" src="${this._data['logo-src']}" alt="Logo">` : ''}
      </a>
    `;
  }
}

customElements.define('tf-promo-card', TfPromoCard);

async function carregarPromocoes(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const promos = await res.json();
    const container = document.querySelector('#promocoes');

    promos.forEach(promo => {
      const card = document.createElement('tf-promo-card');
      card.data = promo;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Erro ao carregar promoções:', err);
  }
}

carregarPromocoes('promo.json');
