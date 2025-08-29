document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('promo.json', { cache: 'no-cache' });
  const promos = await res.json();
  const container = document.getElementById('promocoes');

  promos.forEach(item => {
    const card = document.createElement('tf-promo-card');
    Object.entries(item).forEach(([k, v]) => {
      if (v) card.setAttribute(k, v);
    });
    container.appendChild(card);
  });
});

if (!customElements.get('tf-promo-card')) {
  class TfPromoCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
      return [
        'format','image-src','image-alt','badge-text','destination',
        'subtitle','origin','dates','includes','hotel',
        'price','currency','logo-src','link'
      ];
    }

    connectedCallback() { this.render(); }
    attributeChangedCallback() { if (this.isConnected) this.render(); }

    render() {
      const f = a => this.getAttribute(a) || '';
      const price = f('currency') && !/€/.test(f('price'))
        ? `${f('price')}${f('currency')}` : f('price');

      this.shadowRoot.innerHTML = `
        <style>${this.getCss()}</style>
        <div class="card format-${f('format')}">
          <a class="image-link" href="${f('link') || '#'}">
            <div class="image">
              <img src="${f('image-src')}" alt="${f('image-alt')}">
              ${f('badge-text') ? `<div class="badge">${f('badge-text')}</div>` : ''}
            </div>
          </a>
          <div class="overlay">
            <div class="text-block">
              ${f('destination') ? `<h3 class="title">${f('destination')}</h3>` : ''}
              ${f('subtitle') ? `<p class="subtitle">${f('subtitle')}</p>` : ''}
              ${(f('origin') || f('dates')) ? `<p class="meta">${[f('origin'), f('dates')].filter(Boolean).join(' | ')}</p>` : ''}
              ${f('includes') ? `<p class="includes">${f('includes')}</p>` : ''}
              ${f('hotel') ? `<p class="hotel">${f('hotel')}</p>` : ''}
            </div>
            <div class="bottom-row">
              ${price ? `<span class="price">${price}</span>` : ''}
              ${f('logo-src') ? `<img class="logo" src="${f('logo-src')}" alt="Logo">` : ''}
            </div>
          </div>
        </div>
      `;
    }

    getCss() {
      return `
        :host { display: block; font-family: var(--tf-font-family-display); }
        .card { position: relative; border-radius: 10px; overflow: hidden; }
        .image { position: relative; width: 100%; aspect-ratio: 16/9; }
        .image img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .badge {
          position: absolute; top: 14px; left: 14px;
          background: #d4a017; color: #000;
          padding: 6px 12px; font-weight: 900; font-size: 0.85rem;
          border-radius: 4px; text-transform: uppercase;
        }
        .overlay {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          justify-content: space-between;
          background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 60%, transparent 100%);
          padding: 16px;
        }
        .text-block {
          margin-top: auto;
        }
        .title {
          margin: 0; font-size: 1.8rem; font-weight: 900; color: #fff;
          text-transform: uppercase; line-height: 1.1;
        }
        .subtitle, .meta, .includes, .hotel {
          margin: 2px 0; font-size: 0.95rem; color: #fff;
        }
        .meta { font-size: 0.85rem; opacity: 0.9; }
        .bottom-row {
          display: flex; justify-content: space-between; align-items: flex-end;
        }
        .price {
          background: #d4a017; color: #000; font-weight: 900;
          padding: 4px 10px; border-radius: 6px; font-size: 1.4rem;
        }
        .logo {
          max-height: 40px; width: auto;
        }
      `;
    }
  }
  customElements.define('tf-promo-card', TfPromoCard);
}
