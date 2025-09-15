// Dados das promoções
const promotionsData = [
    {
        id: 1,
        image: 'img/promotions/malta.webp',
        fallback: 'img/promotions/malta.png', 
        //badge: '20% OFF',
        title: 'Malta em Dezembro para duas pessoas',
        description: 'Sol suave, história milenar e paisagens que aquecem o inverno. Transfers incluídos!',
        price: { original: '€599', discount: '€479' },
        cta: 'Reservar já',
        featured: true
    },
    {
        id: 2,
        image: 'img/promotions/bali-promo.webp',
        fallback: 'img/promotions/bali-promo.jpg',
        badge: '30% OFF',
        title: 'Escapadinha Bali',
        description: 'Paraíso tropical com cultura fascinante. 7 noites em resort 5 estrelas.',
        price: { original: '€1299', discount: '€909' },
        cta: 'Reservar Já',
        featured: true
    },
    {
        id: 3,
        image: 'img/promotions/family-promo.webp',
        fallback: 'img/promotions/family-promo.jpg',
        badge: 'FAMÍLIA',
        title: 'Pacote Família',
        description: '2 crianças grátis em destinos selecionados. Diversão garantida para todos!',
        price: { original: '€899', discount: '€599' },
        cta: 'Saber Mais',
        featured: false
    },
    {
        id: 4,
        image: 'img/promotions/weekend-promo.webp',
        fallback: 'img/promotions/weekend-promo.jpg',
        badge: 'FLASH SALE',
        title: 'Weekend Especial',
        description: '3 noites pelo preço de 2 em cidades europeias. Última semana!',
        price: { original: '€349', discount: '€249' },
        cta: 'Aproveitar',
        featured: false
    }
];

// Função para gerar slides do carousel
function generateCarouselSlides() {
    const swiperWrapper = document.getElementById('promoSlides');
    const featuredPromotions = promotionsData.filter(promo => promo.featured);
    
swiperWrapper.innerHTML = featuredPromotions.map(promo => `
  <div class="swiper-slide">
    <div class="promo-slide">
      <div class="slide-image" style="background-image: url('${promo.image}');">
      </div>
      <div class="slide-content">
        <h3>${promo.title}</h3>
        <p>${promo.description}</p>
        <a href="#" class="slide-cta" onclick="handlePromoClick(${promo.id})">${promo.cta}</a>
      </div>
    </div>
  </div>
`).join('');
}

// Função para gerar cards da grid
function generatePromoGrid() {
    const promoGrid = document.getElementById('promoGrid');
    const gridPromotions = promotionsData.filter(promo => !promo.featured);
    
    promoGrid.innerHTML = gridPromotions.map(promo => `
        <div class="promo-card" onclick="handlePromoClick(${promo.id})">
            <div class="promo-card-image" style="background-image: url('${promo.image}'), url('${promo.fallback}')">
                <div class="card-badge">${promo.badge}</div>
            </div>
            <div class="promo-card-content">
                <h4>${promo.title}</h4>
                <p>${promo.description}</p>
                <div class="card-price">
                    <div>
                        <div class="price-original">${promo.price.original}</div>
                        <div class="price-discount">${promo.price.discount}</div>
                    </div>
                    <button class="slide-cta" style="padding: 8px 16px; font-size: 0.9rem;">
                        ${promo.cta}
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Função para inicializar o Swiper
function initializeSwiper() {
    new Swiper('.promo-carousel', {
        slidesPerView: 1,
        spaceBetween: 0,
        loop: true,
        autoplay: {
            delay: 4000,
            disableOnInteraction: false,
        },
        effect: 'fade',
        fadeEffect: {
            crossFade: true
        },
        navigation: {
            nextEl: '.promo-nav-next',
            prevEl: '.promo-nav-prev',
        },
        pagination: {
            el: '.promo-pagination',
            clickable: true,
        },
        on: {
            slideChange: function() {
                // Adicionar animação aos elementos do slide
                const activeSlide = this.slides[this.activeIndex];
                const content = activeSlide.querySelector('.slide-content');
                if (content) {
                    content.style.animation = 'none';
                    content.offsetHeight; // Trigger reflow
                    content.style.animation = 'slideUp 0.8s ease forwards';
                }
            }
        }
    });
}

// Função para lidar com cliques em promoções
function handlePromoClick(promoId) {
    const promo = promotionsData.find(p => p.id === promoId);
    if (promo) {
        // Aqui você pode redirecionar para página de detalhes ou abrir modal
        console.log('Promoção clicada:', promo.title);
        // Exemplo: window.location.href = `promo-details.html?id=${promoId}`;
        // Ou chamar função de orçamento
        if (typeof openQuoteForm === 'function') {
            openQuoteForm();
        }
    }
}

// Função para abrir formulário de orçamento (compatibilidade com homepage)
function openQuoteForm() {
    // Se existir o widget Tars, abrir
    if (window.tarsSettings && window.tarsSettings.convid) {
        try {
            // Tentar abrir o widget Tars
            window.parent.postMessage({
                type: 'tars-widget-open'
            }, '*');
        } catch (e) {
            console.log('Widget não disponível, redirecionando...');
            window.open('https://tars.com/chatbot/oORlVw/', '_blank');
        }
    } else {
        // Fallback - redirecionar para formulário externo ou WhatsApp
        window.open('https://wa.me/351918376604?text=Ol%C3%A1%20Tiago,%20vi%20as%20vossas%20promo%C3%A7%C3%B5es%20e%20gostaria%20de%20saber%20mais%20informa%C3%A7%C3%B5es.', '_blank');
    }
}

// Animação CSS dinâmica
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .slide-content {
        animation: slideUp 0.8s ease forwards;
    }
`;
document.head.appendChild(style);

// Inicialização quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    generateCarouselSlides();
    generatePromoGrid();
    
    // Aguardar um frame para garantir que o DOM foi atualizado
    requestAnimationFrame(() => {
        initializeSwiper();
    });
    
    console.log('✅ Galeria de promoções inicializada com sucesso!');
});
