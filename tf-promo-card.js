class TfPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    const cssUrl = '/tf-the.css';   // garante que este caminho abre no browser
    const dataUrl = '/promo.json';  // garante que este caminho abre no browser

    // 1. Carregar CSS do tema
    let themeCss = '';
    try {
      const cssResp = await fetch(cssUrl);
      if (cssResp.ok) themeCss = await cssResp.text();
    } catch (e) {
      console.error('Erro ao carregar CSS do tema:', e);
    }

    // 2. Carregar dados do JSON
    let promoData = [];
    try {
      const dataResp = await fetch(dataUrl);
      if (dataResp.ok) promoData = await dataResp.json();
    } catch (e) {
      console.error('Erro ao carregar promo.json:', e);
    }

    // 3. Renderizar cartões
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
          font-family: var(--tf-font-family-display);
        }

        .image {
          position: relative;
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
          background: var(--tf-color-primary);
          color: var(--tf-text-color-white);
          padding: 4px 8px;
          font-size: 0.8rem;
          border-radius: 4px;
        }

        .content {
          padding: var(--tf-gap);
        }

        .title {
          font-family: var(--tf-font-family-display);
          font-size: 1.4rem;
          font-weight: bold;
          margin: 0 0 0.3em;
          text-transform: uppercase;
          color: var(--tf-text-color);
        }

        .subtitle {
          color: var(--tf-text-color-gray);
          font-size: 1rem;
          margin: 0 0 0.8em;
        }

        .meta {
          font-size: 0.85rem;
          color: var(--tf-text-color-gray);
          margin: 0.2em 0;
        }

        .includes, .hotel, .provider, .rnvat {
          font-size: 0.8rem;
          color: var(--tf-text-color-gray);
          margin: 0.2em 0;
        }

        .price {
          font-size: 1.6rem;
          font-weight: bold;
          color: var(--tf-color-primary);
          margin-top: 0.5em;
        }

        .price-note {
          font-size: 0.75rem;
          display: block;
          color: var(--tf-text-color-gray);
        }
      </style>

      ${promoData.map(item => `
        <div class="card ${item.theme || ''}">
          <div class="image">
            <img src="${item['image-src']}" alt="${item['image-alt'] || ''}">
            ${item['badge-text'] ? `<div class="badge">${item['badge-text']}</div>` : ''}
          </div>
          <div class="content">
            <h3 class="title">${item.destination}</h3>
            <p class="subtitle">${item.subtitle}</p>
            <p class="meta">${item.origin} | ${item.dates}</p>
            <p class="includes">${item.includes}</p>
            <p class="hotel">${item.hotel}</p>
            <div class="price">
              ${item.price} ${item.currency}
              ${item['price-note'] ? `<span class="price-note">${item['price-note']}</span>` : ''}
            </div>
            <p class="provider">${item.provider}</p>
            <p class="rnvat">${item.rnvat}</p>
          </div>
        </div>
      `).join('')}
    `;
  }
}

customElements.define('tf-promo-card', TfPromoCard);
