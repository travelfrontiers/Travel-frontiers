// Boot: carrega promo.json e injeta cartões
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('promo.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
    const promos = await res.json();

    const container = document.getElementById('promocoes');
    promos.forEach(item => {
      const card = document.createElement('tf-promo-card');
      Object.entries(item).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') card.setAttribute(k, String(v));
      });
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Falha ao carregar promoções:', err);
  }
});

// Web Component
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
      const a = n => this.getAttribute(n) || '';
      const hasEuro = /€/.test(a('price'));
      const price = a('currency') && !hasEuro ? `${a('price')}${a('currency')}` : a('price');
      const format = a('format') || 'banner';

      // Link só na imagem
      const linkStart = a('link') && a('link') !== '#' ? `<a class="image-link" href="${a('link')}" target="_self" rel="noopener">` : `<div class="image-link">`;
      const linkEnd = a('link') && a('link') !== '#' ? `</a>` : `</div>`;

      this.shadowRoot.innerHTML = `
        <style>${this.getCss()}</style>
        <div class="card format-${format}">
          <div class="image-wrap">
            ${linkStart}
              <img src="${a('image-src')}" alt="${a('image-alt')}">
            ${linkEnd}

            ${a('badge-text') ? `<div class="badge">${a('badge-text')}</div>` : ''}

            <div class="overlay">
              <div class="text-box">
                ${a('destination') ? `<h3 class="title">${a('destination')}</h3>` : ''}
                ${a('subtitle') ? `<p class="subtitle">${a('subtitle')}</p>` : ''}
                ${(a('origin') || a('dates')) ? `<p class="meta">${[a('origin'), a('dates')].filter(Boolean).join(' | ')}</p>` : ''}
                ${a('includes') ? `<p class="includes">${a('includes')}</p>` : ''}
                ${a('hotel') ? `<p class="hotel">${a('hotel')}</p>` : ''}
              </div>

              <div class="bottom-row">
                ${price ? `<span class="price">${price}</span>` : ''}
                ${a('logo-src') ? `<img class="logo" src="${a('logo-src')}" alt="Logo">` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    getCss() {
      return `
        :host {
          display: block;
          --tf-font-family-display: 'Montserrat', system-ui, sans-serif;

          /* Cores e estética */
          --tf-color-primary: #d4a017;
          --tf-white: #fff;

          /* Caixa de texto (ajusta aqui para “subir/descer”) */
          --tf-textbox-bottom: 28%;
          --tf-textbox-bg: rgba(0,0,0,0.48);
          --tf-textbox-border: rgba(255,255,255,0.16);

          /* Gradiente de overlay */
          --tf-overlay-strong: 0.70;
          --tf-overlay-mid: 0.25;

          /* Tipografia */
          --tf-title-size: 2.2rem;
          --tf-subtitle-size: 1.05rem;
          --tf-meta-size: 0.95rem;

          /* Preço (balão) */
          --tf-price-size: 1.9rem;
          --tf-price-pad-v: 7px;
          --tf-price-pad-h: 14px;

          font-family: var(--tf-font-family-display, sans-serif);
        }

        .card {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 6px 16px rgba(0,0,0,0.18);
          background: #000;
        }

        /* Imagem + formatos */
        .image-wrap { position: relative; width: 100%; line-height: 0; }
        .image-link, .image-link img { display: block; width: 100%; height: 100%; }
        .image-link img { object-fit: cover; }

        /* Aspect ratio por formato */
        .format-banner .image-wrap { aspect-ratio: 16 / 9; }
        .format-square .image-wrap { aspect-ratio: 1 / 1; }
        .format-story  .image-wrap { aspect-ratio: 9 / 16; }

        /* Badge */
        .badge {
          position: absolute;
          top: 14px; left: 14px;
          background: var(--tf-color-primary);
          color: #000;
          padding: 7px 12px;
          border-radius: 6px;
          font-weight: 900;
          font-size: 0.95rem;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          z-index: 3;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
          pointer-events: none;
        }

        /* Overlay geral */
        .overlay {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none; /* deixa a imagem (link) clicável */
          background: linear-gradient(
            to top,
            rgba(0,0,0,var(--tf-overlay-strong)) 0%,
            rgba(0,0,0,var(--tf-overlay-mid)) 55%,
            rgba(0,0,0,0) 85%
          );
        }

        /* Caixa de texto elevada e mais acima */
        .text-box {
          position: absolute;
          left: 16px; right: 16px;
          bottom: var(--tf-textbox-bottom);
          max-width: 92%;
          background: var(--tf-textbox-bg);
          border: 1px solid var(--tf-textbox-border);
          border-radius: 10px;
          padding: 12px 14px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.25);
          backdrop-filter: saturate(120%) blur(2px);
        }

        .title {
          margin: 0 0 6px 0;
          font-size: var(--tf-title-size);
          font-weight: 900;
          color: var(--tf-white);
          text-transform: uppercase;
          line-height: 1.06;
          letter-spacing: 0.4px;
          text-shadow: 0 2px 10px rgba(0,0,0,0.6);
        }

        .subtitle, .meta, .includes, .hotel {
          margin: 4px 0;
          color: var(--tf-white);
          text-shadow: 0 2px 8px rgba(0,0,0,0.55);
        }
        .subtitle { font-size: var(--tf-subtitle-size); }
        .meta { font-size: var(--tf-meta-size); opacity: 0.95; }

        /* Linha inferior com preço (balão grande) e logo */
        .bottom-row {
          position: absolute;
          left: 12px; right: 12px; bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }

        .price {
          display: inline-block;
          background: var(--tf-color-primary);
          color: #000;
          font-weight: 900;
          font-size: var(--tf-price-size);
          padding: var(--tf-price-pad-v) var(--tf-price-pad-h);
          border-radius: 10px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.4);
        }

        .logo {
          max-height: 46px;
          width: auto;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
        }

        /* Ajustes por formato */
        .format-square .title { font-size: calc(var(--tf-title-size) * 1.05); }
        .format-story  .title { font-size: calc(var(--tf-title-size) * 0.95); }

        @media (min-width: 768px) {
          :host {
            --tf-title-size: 2.6rem;
            --tf-subtitle-size: 1.1rem;
            --tf-meta-size: 1rem;
            --tf-price-size: 2.1rem;
          }
          .logo { max-height: 52px; }
        }
      `;
    }
  }

  customElements.define('tf-promo-card', TfPromoCard);
}
