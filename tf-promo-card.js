class TfPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    // Caminho para o CSS e JSON
    const cssUrl = '/tf-the.css'; // ajusta conforme estrutura
    const dataUrl = '/promo.json'; // ajusta conforme estrutura

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

    // Renderiza cartões
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
          font-family: var(--tf-font-family);
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
          color: var(--tf-text-color);
        }

        .subtitle {
          color: var(--tf-text-color-gray);
          font-size: 0.9rem;
          margin: 0 0 1em;
        }

        .price {
          font-size: 1.2rem;
          font-weight: bold;
          color: var(--tf-color-primary);
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
      </style>
     ${promoData.map(item => `
  <div class="card">
    <div class="image">
      <img src="${item['image-src']}" alt="${item['image-alt']}">
    </div>
    ${item['badge-text'] ? `<div class="badge">${item['badge-text']}</div>` : ''}
    <div class="content">
      <h3 class="title">${item.destination}</h3>
      <p class="subtitle">${item.subtitle}</p>
      <div class="price">
        ${item.price} ${item.currency}
        <span class="price-note">${item['price-note'] || ''}</span>
      </div>
      <p class="origin">${item.origin}</p>
      <p class="dates">${item.dates}</p>
      <p class="includes">${item.includes}</p>
      <p class="hotel">${item.hotel}</p>
      <p class="provider">${item.provider}</p>
      <p class="rnvat">${item.rnvat}</p>
    </div>
  </div>
`).join('')}
    `;
  }
}

customElements.define('tf-promo-card', TfPromoCard);
