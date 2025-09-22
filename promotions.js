// ======== DADOS DAS PROMOÇÕES ========
const promotionsData = [
    {
        id: 1,
        image: 'img/promotions/malta.webp',
        title: 'Malta em Dezembro',
        dates: '2–8 Dezembro',
        description: 'Sol suave, história milenar e paisagens que aquecem o inverno. Transfers incluídos!',
        price: { original: '€599', discount: '€479' },
        cta: 'Reservar já',
        featured: true
    },
    {
        id: 2,
        image: 'img/promotions/cruise.webp',
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
        title: 'Weekend Especial',
        dates: 'Próxima semana',
        description: '3 noites pelo preço de 2 em cidades europeias. Última semana!',
        price: { original: '€349', discount: '€249' },
        cta: 'Aproveitar',
        featured: false
    }
];

// ======== FUNÇÕES GLOBAIS LIGHTBOX ========
function openLightbox(src, caption) {
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxCaption = document.getElementById('lightboxCaption');
    
    if (lightboxOverlay && lightboxImage) {
        lightboxImage.src = src;
        if (lightboxCaption) {
            lightboxCaption.textContent = caption || '';
        }
        lightboxOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeLightbox() {
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    if (lightboxOverlay) {
        lightboxOverlay.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// ======== GERAÇÃO DO CARROSSEL ========
function generateCarouselSlides() {
    const swiperWrapper = document.getElementById('promoSlides');
    if (!swiperWrapper) return;
    
    const featured = promotionsData.filter(p => p.featured);
    
    swiperWrapper.innerHTML = featured.map(p => `
        <div class="swiper-slide">
            <div class="promo-slide">
                <div class="slide-image" 
                     style="background-image:url('${p.image}');cursor:pointer"
                     onclick="openLightbox('${p.image}', '${p.title} — ${p.dates}')"
                     role="button"
                     tabindex="0"
                     aria-label="Ver imagem de ${p.title}">
                    <div class="slide-badge">${p.price.discount}</div>
                </div>
                <div class="slide-content">
                    <h3>${p.title}</h3>
                    <p>${p.dates}</p>
                    <p>${p.description || ''}</p>
                    <div class="price-info">
                        ${p.price.original ? `<span class="price-original">${p.price.original}</span>` : ''}
                        <span class="price-discount">${p.price.discount}</span>
                    </div>
                    <button class="slide-cta" onclick="handlePromoClick(${p.id})">
                        ${p.cta}
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// ======== GERAÇÃO DO GRID ========
function generatePromoGrid() {
    const grid = document.getElementById('promoGrid');
    if (!grid) return;
    
    const others = promotionsData.filter(p => !p.featured);
    
    grid.innerHTML = others.map(p => `
        <div class="promo-card">
            <div class="promo-card-image" 
                 style="background-image:url('${p.image}');cursor:pointer"
                 onclick="openLightbox('${p.image}', '${p.title} — ${p.dates}')"
                 role="button"
                 tabindex="0"
                 aria-label="Ver imagem de ${p.title}">
                <div class="card-badge">${p.price.discount}</div>
            </div>
            <div class="promo-card-content">
                <h4>${p.title}</h4>
                <p>${p.dates}</p>
                <p>${p.description || ''}</p>
                <div class="card-price">
                    ${p.price.original ? `<span class="price-original">${p.price.original}</span>` : ''}
                    <span class="price-discount">${p.price.discount}</span>
                </div>
                <button class="slide-cta" onclick="handlePromoClick(${p.id})">
                    ${p.cta}
                </button>
            </div>
        </div>
    `).join('');
}

// ======== INICIALIZAÇÃO DO SWIPER ========
function initializeSwiper() {
    if (typeof Swiper === 'undefined') {
        console.error('Swiper não carregado');
        return;
    }
    
    const swiper = new Swiper('.promo-carousel', {
        slidesPerView: 1,
        loop: true,
        autoplay: { 
            delay: 4000, 
            disableOnInteraction: false 
        },
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
    
    return swiper;
}

// ======== GESTÃO DE PROMOÇÕES ========
function handlePromoClick(id) {
    const promo = promotionsData.find(p => p.id === id);
    if (promo) {
        openQuoteForm();
    }
}

function openQuoteForm() {
    if (window.tarsSettings && window.tarsSettings.convid) {
        try {
            window.parent.postMessage({ type: 'tars-widget-open' }, '*');
        } catch(e) {
            openWhatsApp();
        }
    } else {
        openWhatsApp();
    }
}

function openWhatsApp() {
    const message = encodeURIComponent('Olá Tiago, gostaria de saber mais sobre as promoções disponíveis.');
    window.open(`https://wa.me/351918376604?text=${message}`, '_blank');
}

// ============================
// Mobile menu
// ============================
function initializeMobileMenu() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('show');
      mobileMenuBtn.classList.toggle('active');
    });

    const mobileLinks = mobileMenu.querySelectorAll('a');
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('show');
        mobileMenuBtn.classList.remove('active');
      });
    });
  }
}

// ======== EVENT LISTENERS GLOBAIS ========
function initEventListeners() {
    // Suporte para ESC no lightbox
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeLightbox();
        }
    });
    
    // Click no overlay do lightbox para fechar
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    if (lightboxOverlay) {
        lightboxOverlay.addEventListener('click', function(e) {
            if (e.target === this) {
                closeLightbox();
            }
        });
    }
    
    // Botão de fechar do lightbox
    const lightboxClose = document.getElementById('lightboxClose');
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }
}

// ======== TORNAR FUNÇÕES GLOBAIS ========
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.handlePromoClick = handlePromoClick;
window.openQuoteForm = openQuoteForm;

// ======== INICIALIZAÇÃO PRINCIPAL ========
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, inicializando página...');
    
    try {
        // 1. Inicializar menu mobile primeiro
        initMobileMenu();
        
        // 2. Gerar conteúdo das promoções
        generateCarouselSlides();
        generatePromoGrid();
        
        // 3. Inicializar Swiper
        setTimeout(() => {
            initializeSwiper();
        }, 100);
        
        // 4. Inicializar event listeners
        initEventListeners();
        
        console.log('Página inicializada com sucesso!');
        
    } catch (error) {
        console.error('Erro durante a inicialização:', error);
    }
});

// ======== WIDGET TARS ========
(function(){
    var js, fs, d=document, id="tars-widget-script", 
        b="https://tars-file-upload.s3.amazonaws.com/bulb/";
    if(!d.getElementById(id)){
        js=d.createElement("script");
        js.id=id;
        js.type="text/javascript";
        js.src=b+"js/widget.js";
        fs=d.getElementsByTagName("script")[0];
        fs.parentNode.insertBefore(js, fs);
    }
})();

window.tarsSettings = {"convid":"oORlVw"};
