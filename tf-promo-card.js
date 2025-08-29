class TfPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set data(promo) {
    this.render(promo);
  }

  render(promo) {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          font-family: var(--tf-font-family-display, sans-serif);
          color: #fff;
          overflow: hidden;
          border-radius: 10px;
        }
        img.bg {
          width: 100%;
          height: 260px;
          object-fit: cover;
          display: block;
        }
        .overlay {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 12px 16px;
          background: linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0));
        }
        .badge {
          position: absolute;
          top: 8px;
          left: 8px;
          background: crimson;
          color: #fff;
          padding: 4px 8px;
          font-size: 0.8rem;
          font-weight: bold;
          border-radius: 4px;
        }
        .title { font-size: 2rem; font-weight: 900; margin: 0 0 6px; text-transform: uppercase; }
        .subtitle { font-size: 1rem; margin: 0 0 4px; }
        .meta, .includes, .hotel { font-size: 0.9rem; margin: 0 0 3px; }
        .price {
          display: inline-block;
          margin-top: 8px;
          font-size: 1.2rem;
          font-weight: 800;
          background: var(--tf-color-primary, #ffcc00);
          color: #000;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .logo {
          position: absolute;
          bottom: 8px;
          right: 8px;
          max-height: 40px;
        }
        a {
          color: inherit;
          text-decoration: none;
          display: block;
        }
      </style>

      <a href="${promo.link || '#'}">
        ${promo['badge-text'] ? `<span class="badge">${promo['badge-text']}</span>` : ''}
        ${promo['image-src'] ? `<img class="bg" src="${promo['image-src']}" alt="${promo['image-alt'] || ''}">` : ''}
        <div class="overlay">
          ${promo.destination ? `<h3 class="title">${promo.destination}</h3>` : ''}
          ${promo.subtitle ? `<p class="subtitle">${promo.subtitle}</p>` : ''}
          ${(promo.origin || promo.dates) ? `<p class="meta">${[promo.origin, promo.dates].filter(Boolean).join(' | ')}</p>` : ''}
          ${promo.includes ? `<p class="includes">${promo.includes}</p>` : ''}
          ${promo.hotel ? `<p class="hotel">${promo.hotel}</p>` : ''}
          ${promo.price ? `<span class="price">${promo.price}</span>` : ''}
        </div>
        ${promo['logo-src'] ? `<img class="logo" src="${promo['logo-src']}" alt="Logo">` : ''}
      </a>
    `;
  }
}

customElements.define('tf-promo-card', TfPromoCard);

// Função para carregar o JSON e criar os cartões
async function carregarPromocoes(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const promos = await res.json();

    const container = document.querySelector('#promocoes');
    promos.forEach(promo => {
      const card = document.createElement('tf-promo-card');
      card.data = promo;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Erro ao carregar promoções:', err);
  }
}

// Chama a função com o caminho para o teu JSON
carregarPromocoes('promocoes.json');
