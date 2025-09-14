// Import dinâmico de webp via glob (Vite) ou lista manual
const promoImages = import.meta.glob('/img/promotions/*.{webp}', { eager: true, as: 'url' });

// Captions fixas (poderá extrair de JSON externo ou translations)
const captions = [
  'Oferta de Verão: 20% de desconto',
  'Pacote Família: 2 crianças grátis',
  // … adicione conforme ficheiros
];

function renderPromotions() {
  const grid = document.querySelector('.promotions-grid');
  const urls = Object.values(promoImages);
  grid.innerHTML = urls.map((url, i) => `
    <div class="promo-card">
      <picture>
        <source srcset="${url}" type="image/webp">
        <img src="${url.replace('.webp','.jpg')}" alt="">
      </picture>
      <p>${captions[i] || ''}</p>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', renderPromotions);
