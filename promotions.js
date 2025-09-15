// Dados das promoções
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
        image: 'img/promotions/bali-promo.webp',
        fallback: 'img/promotions/bali-promo.jpg',
        title: 'Escapadinha Bali',
        dates: '10–17 Janeiro',
        description: 'Paraíso tropical com cultura fascinante. 7 noites em resort 5 estrelas.',
        price: { original: '€1299', discount: '€909' },
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

// Gera slides do carousel
function generateCarouselSlides() {
    const swiperWrapper = document.getElementById('promoSlides');
    const featured = promotionsData.filter(p => p.featured);
    swiperWrapper.innerHTML = featured.map(p => `
        <div class="swiper-slide">
            <div class="promo-slide">
                <div
                    class="slide-image"
                    style="background-image:url('${p.image}');"
                    onclick="openLightbox('${p.image}', '${p.title} — ${p.dates}')"
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

// Gera cards da grid
function generatePromoGrid() {
    const grid = document.getElementById('promoGrid');
    const others = promotionsData.filter(p => !p.featured);
    grid.innerHTML = others.map(p => `
        <div class="promo-card">
            <div
                class="promo-card-image"
                style="background-image:url('${p.image}');"
                onclick="openLightbox('${p.image}', '${p.title} — ${p.dates}')"
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

// Inicializa Swiper
function initializeSwiper() {
    new Swiper('.promo-carousel', {
        slidesPerView: 1,
        loop: true,
        autoplay: { delay: 4000, disableOnInteraction: false },
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

// Ao clicar na promoção
function handlePromoClick(id) {
    const promo = promotionsData.find(p => p.id === id);
    if (promo) {
        console.log('Promoção clicada:', promo.title);
        openQuoteForm();
    }
}

// Lightbox
function openLightbox(src, caption) {
    const lb = document.getElementById('promoLightbox');
    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightboxCaption').textContent = caption;
    lb.style.display = 'flex';
}
function closeLightbox() {
    document.getElementById('promoLightbox').style.display = 'none';
}

// Eventos lightbox
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('lightboxClose').onclick = closeLightbox;
    document.getElementById('promoLightbox').onclick = e => {
        if (e.target.id === 'promoLightbox') closeLightbox();
    };
});

// Função de orçamento
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

// Animação slide-up
const style = document.createElement('style');
style.textContent = `
@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
.slide-content { animation: slideUp 0.8s ease forwards; }
`;
document.head.appendChild(style);

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    generateCarouselSlides();
    generatePromoGrid();
    initializeSwiper();
});
