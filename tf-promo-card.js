class TfPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    // Lê o CSS do tema
    const cssUrl = '/tf-the.css'; // ajusta o caminho correto
    let themeCss = '';
    try {
      const resp = await fetch(cssUrl);
      if (resp.ok) themeCss = await resp.text();
    } catch (e) {
      console.error('Não foi possível carregar o CSS do tema:', e);
    }

    // Renderiza o conteúdo
    this.shadowRoot.innerHTML = `
      <style>
        ${themeCss}

        :host {
          display: block;
          font-family: var(--tf-font-family);
          color: var(--tf-text-color);
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: var(--tf-shadow);
          max-width: 350px;
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

        .card {
          position: relative;
        }
      </style>

      <div class="card">
        <div class="image">
          <img src="${this.getAttribute('image') || ''}" alt="${this.getAttribute('title') || ''}">
        </div>
        ${this.getAttribute('badge-text') ? `<div class="badge">${this.getAttribute('badge-text')}</div>` : ''}
        <div class="content">
          <h3 class="title">${this.getAttribute('title') || ''}</h3>
          <p class="subtitle">${this.getAttribute('subtitle') || ''}</p>
          <div class="price">${this.getAttribute('price') || ''}</div>
        </div>
      </div>
    `;
  }
}

customElements.define('tf-promo-card', TfPromoCard);
