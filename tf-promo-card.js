class TfPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    // Caminhos — ajusta conforme a tua estrutura
    const cssUrl = '/tf-the.css';
    const dataUrl = '/promo.json';

    // Lê CSS do tema
    let themeCss = '';
    try {
      const cssResp = await fetch(cssUrl);
      if (cssResp.ok) themeCss = await cssResp.text();
    } catch (e) {
      console.error('Erro ao carregar CSS do tema:', e);
    }

    // Lê dados do promo.json
    let promoData = [];
    try {
      const dataResp = await fetch(dataUrl);
      if (dataResp.ok) promoData = await dataResp.json();
    } catch (e) {
      console.error('Erro ao carregar promo.json:', e);
    }

    // Renderiza os cartões com classes e variáveis do tema
    this.shadowRoot.innerHTML = `
      <style>
        ${themeCss}

        :host {
          display: flex;
          flex-wrap: wrap;
          gap: var(--tf-gap);
        }

        .card {
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: var(--tf-shadow);
          max-width: 350px;
          position: relative;
          font-family: var(--tf-font-family, var(--tf-font));
        }

        .image img {
          display: block;
          width: 100%;
          height: auto;
        }

        .content {
          padding: var(--tf-gap);
        }

        .title {
          font-family: var(--tf-font-family-display);
          font-size: 1.4rem;
          margin: 0 0 0.3em;
          color: var(--tf-text-color, var(--tf-text));
        }

        .subtitle {
          color: var(--tf-text-color-gray);
          font-size: 0.9rem;
          margin: 0 0 0.5em;
        }

        .meta, .includes, .hotel, .notes, .rnvat {
          font-size: 0.8rem;
          color: var(--tf-text-color-gray);
          margin: 0.2em 0;
        }

        .price {
          font-size: 1.2rem;
          font-weight: bold;
          color: var(--tf-color-primary, var(--tf-accent));
          margin-top: 0.5em;
        }

        .price-note {
          font-size: 0.75rem;
          font-weight: normal;
          display: block;
          color: var(--tf-text-color-gray);
        }

        .badge {
          position: absolute;
          top: 10px;
          left: 10px;
          background: var(--tf-color-primary, var(--tf-accent));
          color: var(--tf-text-color-white, #fff);
          padding: 4px 8px;
          font-size: 0.8rem;
          border-radius: 4px;
        }

        .cta {
          display: inline-block;
          margin-top: 1em;
          background: var(--tf-color-primary, var(--tf-accent));
          color: var(--tf-text-color-white, #fff);
          padding: 0.5em 1em;
          border: none;
          border-radius: 4px;
          font-size: 0.9rem;
          text-decoration: none;
          cursor: pointer;
        }
      </style>

      ${promoData.map(item => `
        <div class="card ${item.theme || ''}">
          <div class="image">
            <img src="${item['image-src']}" alt="${item['image-alt'] || ''}">
          </div>
          ${item['badge-text'] ? `<div class="badge">${item['badge-text']}</div>` : ''}
          <div class="content">
            <h3 class="title">${item.destination}</h3>
            <p class="subtitle">${item.subtitle}</p>
            <p class="meta">${item.origin} — ${item.dates}</p>
            <p class="includes">${item.includes}</p>
            <p class="hotel">${item.hotel}</p>
            <div class="price">
              ${item.price} ${item.currency}
              ${item['price-note'] ? `<span class="price-note">${item['price-note']}</span>` : ''}
            </div>
            <p class="notes">${item.provider}</p>
            <p class="rnvat">${item.rnvat}</p>
            ${item.link ? `<a href="${item.link}" class="cta">Ver Mais</a>` : ''}
          </div>
        </div>
      `).join('')}
    `;
  }
}

customElements.define('tf-promo-card', TfPromoCard);
