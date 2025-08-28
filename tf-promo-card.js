// tf-promo-card.js
class TFPPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['imagem', 'titulo', 'descricao', 'link', 'preco', 'desconto'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const imagem = this.getAttribute('imagem') || '';
    const titulo = this.getAttribute('titulo') || '';
    const descricao = this.getAttribute('descricao') || '';
    const link = this.getAttribute('link') || '#';
    const preco = this.getAttribute('preco') || '';
    const desconto = this.getAttribute('desconto') || '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.08);
          background: #fff;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          font-family: 'Lato', sans-serif;
        }
        :host(:hover) {
          transform: translateY(-5px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        }
        .image {
          position: relative;
          overflow: hidden;
        }
        .image img {
          display: block;
          width: 100%;
          height: auto;
        }
        .content {
          padding: 16px;
        }
        h3 {
          font-size: 1.1rem;
          margin: 0 0 8px;
          font-family: 'Playfair Display', serif;
          color: var(--primary-color, #0077cc);
        }
        p {
          font-size: 0.95rem;
          line-height: 1.4;
          color: #444;
          margin: 0 0 12px;
        }
        .price {
          font-weight: 600;
          color: #222;
        }
        .discount {
          font-size: 0.9rem;
          color: #d32f2f;
          margin-left: 8px;
        }
        a.button {
          display: inline-block;
          padding: 8px 14px;
          background: var(--primary-color, #0077cc);
          color: #fff;
          border-radius: 4px;
          text-decoration: none;
          font-size: 0.9rem;
        }
        a.button:hover {
          background: var(--primary-color-dark, #005fa3);
        }
      </style>

      <div class="image">
        <img src="${imagem}" alt="${titulo}">
      </div>
      <div class="content">
        <h3>${titulo}</h3>
        <p>${descricao}</p>
        ${preco ? `<span class="price">${preco}</span>` : ''}
        ${desconto ? `<span class="discount">-${desconto}</span>` : ''}
        <div>
          <a href="${link}" class="button">Ver Mais</a>
        </div>
      </div>
    `;
  }
}

customElements.define('tf-promo-card', TFPPromoCard);
