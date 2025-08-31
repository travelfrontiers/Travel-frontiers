// tf-promo-card.js

class TfPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set data(promo) {
    this.shadowRoot.innerHTML = `
      <style>
        .card {
          border: 1px solid #ccc;
          padding: 1rem;
          border-radius: 8px;
          max-width: 300px;
          background: #fff;
        }
        img {
          max-width: 100%;
          border-radius: 4px;
          display: block;
        }
        .badge {
          background: red;
          color: white;
          padding: 0.2rem 0.5rem;
          font-size: 0.8rem;
          border-radius: 4px;
          display: inline-block;
          margin-bottom: 0.5rem;
        }
        .price {
          font-weight: bold;
          font-size: 1.2rem;
          margin-top: 0.5rem;
        }
      </style>
      <div class="card">
        <span class="badge">${promo["badge-text"] || ""}</span>
        <img src="${promo["image-src"]}" alt="${promo["image-alt"] || ""}">
        <h3>${promo.destination || ""}</h3>
        <p>${promo.subtitle || ""}</p>
        <p>${promo.dates || ""}</p>
        <p>${promo.includes || ""}</p>
        <p>Hotel: ${promo.hotel || ""}</p>
        <div class="price">${promo.price || ""} ${promo.currency || ""}</div>
        ${promo["logo-src"] ? `<img src="${promo["logo-src"]}" alt="logo" style="max-width:80px;margin-top:0.5rem;">` : ""}
        ${promo.link ? `<p><a href="${promo.link}">Saber mais</a></p>` : ""}
      </div>
    `;
  }
}

customElements.define('tf-promo-card', TfPromoCard);

async function carregarPromocoes() {
  try {
    const resposta = await fetch('promo.json');
    const promocoes = await resposta.json();

    const container = document.getElementById('promo-container');
    if (!container) {
      console.error('Elemento #promo-container não encontrado no HTML.');
      return;
    }

    promocoes.forEach(promo => {
      const card = document.createElement('tf-promo-card');
      card.data = promo;
      container.appendChild(card);
    });
  } catch (erro) {
    console.error('Erro ao carregar promoções:', erro);
  }
}

document.addEventListener('DOMContentLoaded', carregarPromocoes);
