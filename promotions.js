// ======== Dados das promoções ========
const promotionsData = [
    {
        id: 1,
        image: 'img/promotions/malta.webp',
        fallback: 'img/promotions/malta.png',
        title: 'Malta em Dezembro para duas pessoas',
        dates: '2–8 Dezembro',
        description: 'Sol suave, história milenar e paisagens que aquecem o inverno. Transfers incluídos!',
        price: { original: '€599', discount: '€479' },
        cta: 'Reservar já',
        featured: true
    },
    {
        id: 2,
        image: 'img/promotions/cruise.webp',
        fallback: 'img/promotions/bali-promo.jpg',
        title: 'Cruzeiro Mediterrâneo 2026',
        dates: '11-18 Abril',
        description: 'Cruzeiro Tudo Incluído!',
        price: { original: '€1699', discount: '€1569' },
        cta: 'Reservar já',
        featured: true
    },
    {
        id: 3,
        image: 'img/promotions/family-promo.webp',
        fallback: 'img/promotions/family-promo.jpg',
        title: 'Pacote Família',
        dates: 'Abril 2026',
        description: '2 crianças grátis em destinos selecionados. Diversão garantida para todos!',
        price: { original: '€899', discount: '€599' },
        cta: 'Saber mais',
        featured: false
    },
    {
        id: 4,
        image: 'img/promotions/weekend-promo.webp',
        fallback: 'img/promotions/weekend-promo.jpg',
        title: 'Weekend Especial',
        dates: 'Próxima semana',
        description: '3 noites pelo preço de 2 em cidades europeias. Última semana!',
        price: { original: '€349', discount: '€249' },
        cta: 'Aproveitar',
        featured: false
    }
];

// ====== Carousel ======
function generateCarouselSlides() {
    const swiperWrapper = document.getElementById('promoSlides');
    const featured = promotionsData.filter(p => p.featured);
    swiperWrapper.innerHTML = featured.map(p => `
        <div class="swiper-slide">
            <div class="promo-slide">
                <div
                    class="slide-image"
                    style="background-image:url('${p.image}');cursor:pointer"
                    onclick="openLightbox('${p.image}', ${JSON.stringify(p.title + ' — ' + p.dates)})"
                ></div>
                <div class="slide-content">
                    <h3>${p.title}</h3>
                    <p>${p.dates}</p>
                    <p class="price-discount">${p.price.discount}</p>
                    <a href="#" class="slide-cta" onclick="handlePromoClick(${p.id}); return false;">
                        ${p.cta}
                    </a>
                </div>
            </div>
        </div>
    `).join('');
}

// ====== Grid ======
function generatePromoGrid() {
    const grid = document.getElementById('promoGrid');
    const others = promotionsData.filter(p => !p.featured);
    grid.innerHTML = others.map(p => `
        <div class="promo-card">
            <div
                class="promo-card-image"
                style="background-image:url('${p.image}');cursor:pointer"
                onclick="openLightbox('${p.image}', ${JSON.stringify(p.title + ' — ' + p.dates)})"
            ></div>
            <div class="promo-card-content">
                <h4>${p.title}</h4>
                <p>${p.dates}</p>
                <div class="card-price">
                    <span class="price-original">${p.price.original}</span>
                    <span class="price-discount">${p.price.discount}</span>
                </div>
                <button class="slide-cta" onclick="handlePromoClick(${p.id}); return false;">
                    ${p.cta}
                </button>
            </div>
        </div>
    `).join('');
}

// ====== Swiper ======
function initializeSwiper() {
    new Swiper('.promo-carousel', {
        slidesPerView: 1,
        loop: true,
        autoplay: { delay: 4000, disableOnInteraction: false },
        // ✅ SOLUÇÃO: Permitir cliques nos slides
        preventClicks: false,
        preventClicksPropagation: false,
        navigation: {
            prevEl: '.promo-nav-prev',
            nextEl: '.promo-nav-next'
        },
        pagination: {
            el: '.promo-pagination',
            clickable: true
        }
    });
}

// ====== Promo Button ======
function handlePromoClick(id) {
    const promo = promotionsData.find(p => p.id === id);
    if (promo) {
        openQuoteForm();
    }
}

// ====== LIGHTBOX ======
function openLightbox(src, caption) {
    const lb = document.getElementById('promoLightbox');
    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightboxCaption').textContent = caption;
    lb.style.display = 'flex';
}
function closeLightbox() {
    document.getElementById('promoLightbox').style.display = 'none';
}

// Tornar funções globais para o onclick dinâmico funcionar:
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.handlePromoClick = handlePromoClick;
window.openQuoteForm = openQuoteForm;

// ====== Lightbox events ======
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('lightboxClose').onclick = closeLightbox;
    document.getElementById('promoLightbox').onclick = e => {
        if (e.target.id === 'promoLightbox') closeLightbox();
    };
});

// ====== Orçamento ======
function openQuoteForm() {
    if (window.tarsSettings && window.tarsSettings.convid) {
        window.parent.postMessage({ type: 'tars-widget-open' }, '*');
    } else {
        window.open(
            'https://wa.me/351918376604?text=Olá%20Tiago,%20gostaria%20de%20saber%20mais%20sobre%20a%20promoção.',
            '_blank'
        );
    }
}

document.addEventListener('DOMContentLoaded', function() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', function() {
      mobileMenu.classList.toggle('show');
      mobileMenuBtn.classList.toggle('active');
    });
    // Fecha o menu ao clicar em qualquer link
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', function() {
        mobileMenu.classList.remove('show');
        mobileMenuBtn.classList.remove('active');
      });
    });
  }
});

// ====== Animação slide-up ======
const style = document.createElement('style');
style.textContent = `
@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
.slide-content { animation: slideUp 0.8s ease forwards; }
`;
document.head.appendChild(style);

// ====== Inicialização ======
document.addEventListener('DOMContentLoaded', () => {
    generateCarouselSlides();
    generatePromoGrid();
    initializeSwiper();
});
