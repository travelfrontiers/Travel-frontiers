// tf-promo-card.js

class TfPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set data(promo) {
    this.shadowRoot.innerHTML = `
      <style>
        /* estilos do cartão */
        .card {
          border: 1px solid #ccc;
          padding: 1rem;
          border-radius: 8px;
          max-width: 300px;
        }
        img {
          max-width: 100%;
          border-radius: 4px;
        }
      </style>
      <div class="card">
        <img src="${promo.image}" alt="${promo.title}">
        <h3>${promo.title}</h3>
        <p>${promo.description}</p>
      </div>
    `;
  }
}

customElements.define('tf-promo-card', TfPromoCard);

// Função para carregar promoções e inserir no DOM
async function carregarPromocoes() {
  try {
    const resposta = await fetch('promo.json');
    const promocoes = await resposta.json();

    const container = document.getElementById('promo-container');
    promocoes.forEach(promo => {
      const card = document.createElement('tf-promo-card');
      card.data = promo;
      container.appendChild(card);
    });
  } catch (erro) {
    console.error('Erro ao carregar promoções:', erro);
  }
}

// Chamar automaticamente ao carregar a página
document.addEventListener('DOMContentLoaded', carregarPromocoes);
