// Caminhos manuais para as imagens webp (coloca os teus nomes reais!)
const promoImages = [
  'img/promotions/malta.webp',
  'img/promotions/promo2.webp',
  'img/promotions/promo3.webp'
];

// Legendas associadas (opcional, remove se não quiseres)
const captions = [
  'Oferta de Verão: 20% desconto',
  'Pacote Família: 2 crianças grátis',
  'Escapadinha especial: 3 noites pelo preço de 2'
];

function renderPromotions() {
  const grid = document.querySelector('.promotions-grid');
  grid.innerHTML = promoImages.map((url, i) => `
    <div class="promo-card">
      <picture>
        <source srcset="${url}" type="image/webp">
        <img src="${url.replace('.webp')}" alt="">
      </picture>
      <p>${captions[i] || ''}</p>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', renderPromotions);
