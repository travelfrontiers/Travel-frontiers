class TfPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set data(promo) {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: Arial, sans-serif;
        }
        .card {
          width: 320px;
          border-radius: 8px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .image-wrapper {
          position: relative;
        }
        .image-wrapper img {
          display: block;
          width: 100%;
          height: auto;
        }
        .badge {
          position: absolute;
          top: 12px;
          left: 12px;
          background: #c00;
          color: #fff;
          padding: 0.4rem 0.8rem;
          font-size: 0.85rem;
          font-weight: bold;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 1rem;
          background: linear-gradient(to top, rgba(0,0,0,0.75), transparent);
          color: #fff;
        }
        .overlay h3 {
          margin: 0;
          font-size: 1.8rem;
          font-weight: bold;
          letter-spacing: 1px;
        }
        .overlay p {
          margin: 0.3rem 0 0;
          font-size: 0.95rem;
        }
        .details {
          padding: 1rem;
          font-size: 0.9rem;
          line-height: 1.4;
          color: #333;
        }
        .price {
          font-size: 1.6rem;
          font-weight: bold;
          margin-top: 0.8rem;
          color: #c00;
        }
        .logo {
          display: block;
          max-width: 120px;
          margin-top: 0.8rem;
        }
      </style>
      <div class="card">
        <div class="image-wrapper">
          <img src="${promo['image-src']}" alt="${promo['image-alt']}">
          <span class="badge">${promo['badge-text']}</span>
          <div class="overlay">
            <h3>${promo.destination}</h3>
            <p>${promo.subtitle}</p>
          </div>
        </div>
        <div class="details">
          <div>${promo.dates}</div>
          <div>${promo.includes}</div>
          <div>${promo.hotel}</div>
          <div class="price">${promo.price}</div>
          ${promo['logo-src'] ? `<img class="logo" src="${promo['logo-src']}" alt="logo">` : ""}
        </div>
      </div>
    `;
  }
}

customElements.define('tf-promo-card', TfPromoCard);

async function carregarPromocoes() {
  try {
    const resposta = await fetch('./promo.json');
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const promocoes = await resposta.json();
    const container = document.getElementById('promo-container');

    promocoes
      .filter(p => p.format === 'banner') // só banners
      .forEach(promo => {
        const card = document.createElement('tf-promo-card');
        card.data = promo;
        container.appendChild(card);
      });

  } catch (erro) {
    console.error('Erro ao carregar promoções:', erro);
  }
}

document.addEventListener('DOMContentLoaded', carregarPromocoes);
