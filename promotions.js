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
    console.log('Opening lightbox with:', src, caption);
    const lightboxOverlay = document.getElementById('lightboxOverlay') || document.getElementById('promoLightbox');
    const lightboxImage = document.getElementById('lightboxImage') || document.getElementById('lightboxImg');
    const lightboxCaption = document.getElementById('lightboxCaption');
    
    if (lightboxOverlay && lightboxImage) {
        lightboxImage.src = src;
        if (lightboxCaption) {
            lightboxCaption.textContent = caption || '';
        }
        lightboxOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Previne scroll
    }
}

function closeLightbox() {
    const lightboxOverlay = document.getElementById('lightboxOverlay') || document.getElementById('promoLightbox');
    if (lightboxOverlay) {
        lightboxOverlay.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restaura scroll
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
        },
        on: {
            init: function() {
                console.log('Swiper inicializado com sucesso');
            }
        }
    });
    
    return swiper;
}

// ======== GESTÃO DE PROMOÇÕES ========
function handlePromoClick(id) {
    console.log('Promo clicked:', id);
    const promo = promotionsData.find(p => p.id === id);
    if (promo) {
        openQuoteForm();
    }
}

function openQuoteForm() {
    // Tenta usar o widget Tars primeiro
    if (window.tarsSettings && window.tarsSettings.convid) {
        try {
            window.parent.postMessage({ type: 'tars-widget-open' }, '*');
        } catch(e) {
            console.log('Widget Tars não disponível, usando WhatsApp');
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

// ======== MENU MOBILE SIMPLES E FUNCIONAL ========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando menu mobile...');
    
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    
    // Debug: verificar se os elementos existem
    console.log('Button:', !!mobileMenuBtn);
    console.log('Menu:', !!mobileMenu);
    
    if (mobileMenuBtn && mobileMenu) {
        // Adicionar event listener ao botão
        mobileMenuBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('👆 Menu button clicked!');
            
            // Toggle das classes
            mobileMenu.classList.toggle('show');
            mobileMenuBtn.classList.toggle('active');
            
            console.log('Menu está:', mobileMenu.classList.contains('show') ? 'ABERTO' : 'FECHADO');
        });
        
        // Fechar menu ao clicar nos links
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function() {
                console.log('🔗 Link clicked, fechando menu');
                mobileMenu.classList.remove('show');
                mobileMenuBtn.classList.remove('active');
            });
        });
        
        // Fechar menu ao clicar fora
        document.addEventListener('click', function(e) {
            if (!mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                if (mobileMenu.classList.contains('show')) {
                    console.log('🖱️ Clicked outside, fechando menu');
                    mobileMenu.classList.remove('show');
                    mobileMenuBtn.classList.remove('active');
                }
            }
        });
        
        console.log('✅ Menu mobile inicializado com sucesso!');
    } else {
        console.error('❌ Elementos do menu mobile não encontrados!');
    }
});

// ======== EVENT LISTENERS GLOBAIS ========
function initEventListeners() {
    // Suporte para ESC no lightbox
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeLightbox();
        }
    });
    
    // Click no overlay do lightbox para fechar
    const lightboxOverlay = document.getElementById('lightboxOverlay') || document.getElementById('promoLightbox');
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
        
        // 3. Inicializar Swiper (com timeout para garantir que o DOM está pronto)
        setTimeout(() => {
            initializeSwiper();
        }, 100);
        
        // 4. Inicializar event listeners
        initEventListeners();
        
        // 5. Animação de entrada suave
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .slide-content { 
                animation: slideUp 0.8s ease forwards; 
            }
            .mobile-menu-btn span {
                transition: all 0.3s ease;
            }
        `;
        document.head.appendChild(style);
        
        console.log('Página inicializada com sucesso!');
        
    } catch (error) {
        console.error('Erro durante a inicialização:', error);
    }
});

// ======== WIDGET TARS ========
// Inicialização do widget Tars (se disponível)
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

// Configuração do widget Tars
window.tarsSettings = {"convid":"oORlVw"};
