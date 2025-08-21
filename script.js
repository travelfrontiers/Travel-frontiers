// Multi-language data (keep your existing translations object)
const translations = {
    pt: {
        nav: {
            home: 'Início',
            about: 'Sobre',
            services: 'Serviços',
            testimonials: 'Testemunhos',
            contact: 'Contacto'
        },
        hero: {
            title: 'Explore as Fronteiras do Mundo',
            subtitle: 'Descubra novos horizontes com a Travel Frontiers. Planeie a sua próxima aventura com um consultor especializado em experiências personalizadas.',
            cta: 'Pedir Orçamento',
            stats: {
                experience: '15 anos de experiência',
                countries: '+40 países visitados',
                subtitle1: 'A viajar pelo Mundo',
                subtitle2: 'Em quase todos os continentes'
            }
        },
        about: {
            title: 'Sobre Tiago Ferreira',
            description: 'Apaixonado por descobrir o Mundo, viajo há 15 anos e já explorei mais de 40 países, com especial conhecimento da Ásia, Europa e Norte de África. Com experiência em planear desde grandes aventuras até férias relaxantes em família, dedico-me a criar propostas equilibradas entre preço e qualidade. Cada viagem que concebo é inspirada pelo desejo de partilhar experiências autênticas, acompanhando de perto cada cliente, para que a sua próxima viagem seja tão memorável quanto a minha paixão por viajar.',
            achievements: {
                global: 'Experiência Global',
                certified: 'Consultor Certificado',
                passion: 'Paixão por Viajar',
                trips: 'Viagens Planeadas'
            }
        },
        services: {
            title: 'Os Nossos Serviços',
            subtitle: 'Experiências únicas adaptadas às suas necessidades',
            cta: {
                title: 'Pronto para a sua próxima aventura?',
                subtitle: 'Cada viagem é única. Deixe-nos criar uma experiência inesquecível apenas para si.',
                button: 'Começar Agora'
            },
            items: [
                {
                    title: 'Planeamento Personalizado',
                    description: 'Criamos roteiros únicos baseados nos seus interesses e orçamento, com todos os detalhes cuidadosamente planeados.',
                    image: 'https://images.unsplash.com/photo-1718302661620-0404ab653acb?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85'
                },
                {
                    title: 'Roteiros de Grupo',
                    description: 'Organize viagens em grupo com amigos e família, com atividades especiais e experiências memoráveis.',
                    image: 'img/IMG_7336.jpeg'
                },
                {
                    title: 'Pacotes Completos',
                    description: 'Desde voos a alojamento, atividades e transfers - tudo incluído para uma viagem sem preocupações.',
                    image: 'https://images.unsplash.com/photo-1554366347-897a5113f6ab?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85'
                },
                {
                    title: 'Cruzeiros',
                    description: 'Experiências marítimas exclusivas com os melhores roteiros de cruzeiros pelo mundo, adaptados ao seu perfil.',
                    image: 'https://images.unsplash.com/photo-1594661745200-810105bcf054?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85'
                },
                {
                    title: 'Consultoria Especializada',
                    description: 'Aconselhamento profissional baseado em experiência real de viagem em mais de 40 países.',
                    image: 'img/IMG_8984.jpeg'
                }
            ]
        },
        testimonials: {
            title: 'Testemunhos dos Clientes',
            subtitle: 'O que dizem sobre nós',
            stats: {
                trips: 'Viagens Planeadas',
                countries: 'Países Visitados',
                experience: 'Anos de Experiência'
            },
           items: [
        {
            text: 'Só podemos estar gratos pelo acompanhamento de excelência dedicado. Faz toda a experiência valer muito mais a pena!',
            author: 'Gil Gaspar',
            location: 'Porto Santo 2025'
        },
        {
            text: 'Adoramos cada momento e já estamos ansiosos para a próxima aventura... Contamos com a sua colaboração!! Obrigada por tornar estas férias especiais!!!',
            author: 'Sandra Bernardo',
            location: 'Tenerife 2025'
        },
        {
            text: 'Muito satisfeita com a proposta feita, com todas as atividades para estas férias. O acompanhamento foi perfeito!',
            author: 'Jéssica Ferreira',
            location: 'Itália 2024'
        }
    ]
},
        contact: {
            title: 'Comece a sua Próxima Aventura',
            subtitle: 'Peça o seu orçamento personalizado e deixe-nos planear a viagem dos seus sonhos',
            cta: 'Contactar Agora',
            form: {
                title: 'Pedir Orçamento Personalizado',
                subtitle: 'Clique no botão abaixo para ser redirecionado para o nosso formulário de pedido de orçamento especializado.',
                ready: 'Pronto para a aventura?',
                description: 'Preencha o nosso formulário detalhado e receberá uma proposta personalizada em 24-48h.',
                redirect: 'Será redirecionado para um formulário seguro'
            },
            whyChoose: {
                title: 'Porquê Escolher a Travel Frontiers?',
                experience: 'Experiência real de viagem em +40 países',
                planning: 'Planeamento 100% personalizado',
                support: 'Acompanhamento durante toda a viagem',
                satisfaction: 'Clientes 100% satisfeitos'
            },
            otherMethods: {
                title: 'Outras Formas de Contacto',
                email: 'Email',
                Instagram: 'Segue-me',
                location: 'Localização'
            }
        },
        footer: {
            description: 'Descubra novos horizontes com a Travel Frontiers. Há 15 anos a explorar o mundo e agora a ajudar outros a criar as suas próprias aventuras inesquecíveis!',
            quickLinks: 'Links Rápidos',
            contact: 'Contacto',
            copyright: 'Todos os direitos reservados.',
            privacy: 'Política de Privacidade',
            terms: 'Termos de Serviço'
        }
    },
    en: {
        nav: {
            home: 'Home',
            about: 'About',
            services: 'Services',
            testimonials: 'Testimonials',
            contact: 'Contact'
        },
        hero: {
            title: 'Explore the World\'s Frontiers',
            subtitle: 'Discover new horizons with Travel Frontiers. Plan your next adventure with a consultant specialized in personalized experiences.',
            cta: 'Get Quote',
            stats: {
                experience: '15 years of experience',
                countries: '+40 countries visited',
                subtitle1: 'Traveling the world',
                subtitle2: 'On all continents'
            }
        },
        about: {
            title: 'About Tiago Ferreira',
            description: 'Passionate about exploring the world, I have been traveling for 15 years and have explored over 40 countries, with special knowledge of Asia, Europe, and North Africa. With experience planning everything from great adventures to relaxing family vacations, I am dedicated to creating proposals that balance price and quality. Every trip I design is inspired by the desire to share authentic experiences, providing close support to each client so that their next journey is as memorable as my passion for traveling.',
            achievements: {
                global: 'Global Experience',
                certified: 'Certified Consultant',
                passion: 'Passion for Travel',
                trips: 'Trips Planned'
            }
        },
        services: {
            title: 'Our Services',
            subtitle: 'Unique experiences tailored to your needs',
            cta: {
                title: 'Ready for your next adventure?',
                subtitle: 'Every trip is unique. Let us create an unforgettable experience just for you.',
                button: 'Start Now'
            },
            items: [
                {
                    title: 'Personalized Planning',
                    description: 'We create unique itineraries based on your interests and budget, with every detail carefully planned.',
                    image: 'https://images.unsplash.com/photo-1718302661620-0404ab653acb?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85'
                },
                {
                    title: 'Group Itineraries',
                    description: 'Organize group trips with friends and family, featuring special activities and memorable experiences.',
                    image: 'img/IMG_7336.jpeg'
                },
                {
                    title: 'Complete Packages',
                    description: 'From flights to accommodation, activities and transfers - everything included for a worry-free trip.',
                    image: 'https://images.unsplash.com/photo-1554366347-897a5113f6ab?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85'
                },
                {
                    title: 'Cruises',
                    description: 'Exclusive maritime experiences with the best cruise routes around the world, tailored to your profile.',
                    image: 'https://images.unsplash.com/photo-1594661745200-810105bcf054?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85'
                },
                {
                    title: 'Specialized Consultancy',
                    description: 'Professional advice based on real travel experience in more than 40 countries.',
                    image: 'img/IMG_8984.jpeg?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85'
                }
            ]
        },
        testimonials: {
            title: 'Client Testimonials',
            subtitle: 'What they say about us',
            stats: {
                trips: 'Trips Planned',
                countries: 'Countries Visited',
                experience: 'Years of Experience'
            },
           items: [
        {
            text: 'We can only be grateful for the excellent dedicated support. It makes the whole experience so much more worthwhile!',
            author: 'Gil Gaspar',
            location: 'Porto Santo 2025'
        },
        {
            text: 'We loved every moment and we are already looking forward to the next adventure... We count on your collaboration!! Thank you for making these holidays special!!!',
            author: 'Sandra Bernardo',
            location: 'Tenerife 2025'
        },
        {
            text: 'Very satisfied with the proposal made, with all the activities for this vacation. The support was perfect!',
            author: 'Jéssica Ferreira',
            location: 'Italy 2024'
        }
    ]
},
        contact: {
            title: 'Start Your Next Adventure',
            subtitle: 'Request your personalized quote and let us plan the trip of your dreams',
            cta: 'Contact Now',
            form: {
                title: 'Request Personalized Quote',
                subtitle: 'Click the button below to be redirected to our specialized quote request form.',
                ready: 'Ready for the adventure?',
                description: 'Fill out our detailed form and you will receive a personalized proposal within 24-48h.',
                redirect: 'You will be redirected to a secure form'
            },
            whyChoose: {
                title: 'Why Choose Travel Frontiers?',
                experience: 'Real travel experience in +40 countries',
                planning: '100% personalized planning',
                support: 'Support throughout the entire trip',
                satisfaction: '100% satisfied clients'
            },
            otherMethods: {
                title: 'Other Contact Methods',
                email: 'Email',
                Instagram: 'Follow me',
                location: 'Location'
            }
        },
        footer: {
            description: 'Discover new horizons with Travel Frontiers. 15 years exploring the world and now helping others create their own unforgettable adventures.',
            quickLinks: 'Quick Links',
            contact: 'Contact',
            copyright: 'All rights reserved.',
            privacy: 'Privacy Policy',
            terms: 'Terms of Service'
        }
    },
    fr: {
        nav: {
            home: 'Accueil',
            about: 'À propos',
            services: 'Services',
            testimonials: 'Témoignages',
            contact: 'Contact'
        },
        hero: {
            title: 'Explorez les Frontières du Monde',
            subtitle: 'Découvrez de nouveaux horizons avec Travel Frontiers. Planifiez votre prochaine aventure avec un consultant spécialisé en expériences personnalisées.',
            cta: 'Demander un Devis',
            stats: {
                experience: '15 ans d\'expérience',
                countries: '+40 pays visités',
                subtitle1: 'Voyageant dans le monde',
                subtitle2: 'Sur tous les continents'
            }
        },
        about: {
            title: 'À propos de Tiago Ferreira',
            description: 'Passionné par la découverte du monde, je voyage depuis 15 ans et j'ai exploré plus de 40 pays, avec une connaissance particulière de l'Asie, de l'Europe et de l'Afrique du Nord. Fort d'une expérience dans la planification de grandes aventures comme de vacances relaxantes en famille, je m'engage à créer des propositions équilibrant prix et qualité. Chaque voyage que je conçois est inspiré par le désir de partager des expériences authentiques, accompagnant de près chaque client pour que son prochain périple soit aussi mémorable que ma passion du voyage.',
            achievements: {
                global: 'Expérience Globale',
                certified: 'Consultant Certifié',
                passion: 'Passion pour les Voyages',
                trips: 'Voyages Planifiés'
            }
        },
        services: {
            title: 'Nos Services',
            subtitle: 'Expériences uniques adaptées à vos besoins',
            cta: {
                title: 'Prêt pour votre prochaine aventure?',
                subtitle: 'Chaque voyage est unique. Laissez-nous créer une expérience inoubliable rien que pour vous.',
                button: 'Commencer Maintenant'
            },
            items: [
                {
                    title: 'Planification Personnalisée',
                    description: 'Nous créons des itinéraires uniques basés sur vos intérêts et votre budget, avec chaque détail soigneusement planifié.',
                    image: 'https://images.unsplash.com/photo-1718302661620-0404ab653acb?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85'
                },
                {
                    title: 'Itinéraires de Groupe',
                    description: 'Organisez des voyages de groupe avec des amis et la famille, avec des activités spéciales et des expériences mémorables.',
                    image: 'img/IMG_7336.jpeg'
                },
                {
                    title: 'Forfaits Complets',
                    description: 'Des vols à l\'hébergement, activités et transferts - tout inclus pour un voyage sans souci.',
                    image: 'https://images.unsplash.com/photo-1554366347-897a5113f6ab?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85'
                },
                {
                    title: 'Croisières',
                    description: 'Expériences maritimes exclusives avec les meilleurs itinéraires de croisières dans le monde, adaptés à votre profil.',
                    image: 'https://images.unsplash.com/photo-1594661745200-810105bcf054?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85'
                },
                {
                    title: 'Consultation Spécialisée',
                    description: 'Conseils professionnels basés sur une expérience de voyage réelle dans plus de 40 pays.',
                    image: 'img/IMG_8984.jpeg?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85'
                }
            ]
        },
        testimonials: {
            title: 'Témoignages Clients',
            subtitle: 'Ce qu\'ils disent de nous',
            stats: {
                trips: 'Voyages Planifiés',
                countries: 'Pays Visités',
                experience: 'Années d\'Expérience'
            },
             items: [
        {
            text: 'Nous ne pouvons qu\'être reconnaissants pour l\'excellent soutien dédié. Cela rend toute l\'expérience tellement plus enrichissante!',
            author: 'Gil Gaspar',
            location: 'Porto Santo 2025'
        },
        {
            text: 'Nous avons adoré chaque instant et nous attendons déjà avec impatience la prochaine aventure... Nous comptons sur votre collaboration !! Merci d\'avoir rendu ces vacances spéciales !!!',
            author: 'Sandra Bernardo',
            location: 'Tenerife 2025'
        },
        {
            text: 'Très satisfaite de la proposition faite, avec toutes les activités pour ces vacances. Le soutien était parfait!',
            author: 'Jéssica Ferreira',
            location: 'Italie 2024'
        }
    ]
},
        contact: {
            title: 'Commencez Votre Prochaine Aventure',
            subtitle: 'Demandez votre devis personnalisé et laissez-nous planifier le voyage de vos rêves',
            cta: 'Contactez Maintenant',
            form: {
                title: 'Demander un Devis Personnalisé',
                subtitle: 'Cliquez sur le bouton ci-dessous pour être redirigé vers notre formulaire spécialisé de demande de devis.',
                ready: 'Prêt pour l\'aventure?',
                description: 'Remplissez notre formulaire détaillé et vous recevrez une proposition personnalisée dans les 24-48h.',
                redirect: 'Vous serez redirigé vers un formulaire sécurisé'
            },
            whyChoose: {
                title: 'Pourquoi Choisir Travel Frontiers?',
                experience: 'Expérience de voyage réelle dans +40 pays',
                planning: 'Planification 100% personnalisée',
                support: 'Accompagnement pendant tout le voyage',
                satisfaction: 'Clients 100% satisfaits'
            },
            otherMethods: {
                title: 'Autres Méthodes de Contact',
                email: 'Email',
                Instagram: 'Suis-moi',
                location: 'Localisation'
            }
        },
        footer: {
            description: 'Découvrez de nouveaux horizons avec Travel Frontiers. 15 ans à explorer le monde et maintenant aidant les autres à créer leurs propres aventures inoubliables.',
            quickLinks: 'Liens Rapides',
            contact: 'Contact',
            copyright: 'Tous droits réservés.',
            privacy: 'Politique de Confidentialité',
            terms: 'Conditions de Service'
        }
    }
};

// Global variables
let currentLanguage = 'pt';
let currentTestimonialIndex = 0;
let testimonialTimer = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Restore saved language
    const savedLang = localStorage.getItem('tf_lang');
    if (savedLang && translations[savedLang]) {
        currentLanguage = savedLang;
        document.getElementById('langCode').textContent = savedLang.toUpperCase();
        document.documentElement.lang = savedLang;
    }

    // Initialize components
    initializeLanguageSelector();
    initializeMobileMenu();
    initializeNavigation();
    initializeTestimonials();
    initializeLightbox();
    initializeCarousel();
    initializeContactTracking();
    renderServices();
    updateContent();
    startTestimonialTimer();
});

// Enhanced Language functionality
function initializeLanguageSelector() {
    const langButton = document.getElementById('currentLang');
    const langDropdown = document.getElementById('langDropdown');
    
    if (!langButton || !langDropdown) return;

    // Accessibility attributes
    langButton.setAttribute('aria-expanded', 'false');
    langButton.setAttribute('aria-haspopup', 'true');
    langButton.setAttribute('aria-label', 'Select language');
    
    langButton.addEventListener('click', function() {
        const isOpen = langDropdown.classList.toggle('show');
        langButton.setAttribute('aria-expanded', String(isOpen));
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        if (!langButton.contains(event.target) && !langDropdown.contains(event.target)) {
            langDropdown.classList.remove('show');
            langButton.setAttribute('aria-expanded', 'false');
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            langDropdown.classList.remove('show');
            langButton.setAttribute('aria-expanded', 'false');
        }
    });
}

function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('tf_lang', lang); // Save preference
    document.getElementById('langCode').textContent = lang.toUpperCase();
    document.getElementById('langDropdown').classList.remove('show');
    document.documentElement.lang = lang;
    updateContent();
    renderServices();
    updateTestimonials();
    createTestimonialDots();
}

function updateContent() {
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(element => {
        const key = element.getAttribute('data-translate');
        const translation = getTranslation(key);
        if (translation) {
            element.textContent = translation;
        }
    });
}

function getTranslation(key) {
    const keys = key.split('.');
    let value = translations[currentLanguage];
    
    for (const k of keys) {
        value = value?.[k];
    }
    
    return value;
}

// Enhanced Mobile menu functionality with scroll lock
function initializeMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    
    if (!mobileMenuBtn || !mobileMenu) return;
    
    mobileMenuBtn.addEventListener('click', function() {
        const isOpen = mobileMenu.classList.toggle('show');
        mobileMenuBtn.classList.toggle('active');
        
        // Lock/unlock body scroll
        document.body.style.overflow = isOpen ? 'hidden' : '';
        
        // Close language dropdown when menu opens
        const langDropdown = document.getElementById('langDropdown');
        if (langDropdown) {
            langDropdown.classList.remove('show');
        }
    });
    
    // Close mobile menu when clicking on links
    const mobileLinks = mobileMenu.querySelectorAll('a');
    mobileLinks.forEach(link => {
        link.addEventListener('click', function() {
            mobileMenu.classList.remove('show');
            mobileMenuBtn.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
}

// Navigation functionality
function initializeNavigation() {
    const navLinks = document.querySelectorAll('a[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            
            if (targetSection) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Enhanced Services functionality
function renderServices() {
    const servicesGrid = document.querySelector('.services-grid');
    if (!servicesGrid) return;
    
    const services = translations[currentLanguage].services.items;
    
    // Generate service cards with proper dimensions for CLS prevention
    servicesGrid.innerHTML = services.map(service => `
        <div class="service-card">
            <div class="service-image">
                <img src="${service.image}" 
                     alt="${service.title} — Travel Frontiers"
                     loading="lazy" 
                     class="clickable-service"
                     width="600" 
                     height="400">
                <div class="service-overlay"></div>
                <h3 class="service-title">${service.title}</h3>
            </div>
            <div class="service-content">
                <p class="service-description">${service.description}</p>
            </div>
        </div>
    `).join('');
}

// Enhanced Lightbox functionality
function initializeLightbox() {
    const lightbox = document.getElementById('lightbox');
    const closeBtn = document.querySelector('.lightbox-close');
    
    if (!lightbox || !closeBtn) return;

    function openLightbox(imgSrc, imgAlt) {
        const lightboxImg = lightbox.querySelector('img');
        lightboxImg.src = imgSrc;
        lightboxImg.alt = imgAlt || 'Imagem ampliada';
        lightbox.classList.add('show');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    function closeLightbox() {
        lightbox.classList.remove('show');
        lightbox.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = ''; // Restore scroll
    }

    // Close handlers
    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });

    // Service image clicks
    document.addEventListener('click', (e) => {
        if (e.target.matches('.clickable-service')) {
            openLightbox(e.target.src, e.target.alt);
        }
    });
}

// Enhanced Testimonials functionality
function initializeTestimonials() {
    const prevBtn = document.getElementById('prevTestimonial');
    const nextBtn = document.getElementById('nextTestimonial');
    
    if (!prevBtn || !nextBtn) return;
    
    prevBtn.addEventListener('click', function() {
        currentTestimonialIndex = currentTestimonialIndex === 0 
            ? translations[currentLanguage].testimonials.items.length - 1 
            : currentTestimonialIndex - 1;
        updateTestimonials();
        restartTestimonialTimer();
    });
    
    nextBtn.addEventListener('click', function() {
        currentTestimonialIndex = (currentTestimonialIndex + 1) % translations[currentLanguage].testimonials.items.length;
        updateTestimonials();
        restartTestimonialTimer();
    });
    
    createTestimonialDots();
    updateTestimonials();
}

function createTestimonialDots() {
    const dotsContainer = document.getElementById('testimonialDots');
    if (!dotsContainer) return;
    
    const testimonials = translations[currentLanguage].testimonials.items;
    
    dotsContainer.innerHTML = testimonials.map((_, index) => 
        `<div class="dot ${index === currentTestimonialIndex ? 'active' : ''}" 
              onclick="goToTestimonial(${index})" 
              aria-label="Go to testimonial ${index + 1}"></div>`
    ).join('');
}

function updateTestimonials() {
    const testimonials = translations[currentLanguage].testimonials.items;
    const currentTestimonial = testimonials[currentTestimonialIndex];
    
    const testimonialText = document.getElementById('currentTestimonial');
    const authorName = document.getElementById('currentAuthor');
    const authorLocation = document.getElementById('currentLocation');
    
    if (testimonialText) testimonialText.textContent = `"${currentTestimonial.text}"`;
    if (authorName) authorName.textContent = currentTestimonial.author;
    if (authorLocation) authorLocation.textContent = currentTestimonial.location;
    
    // Update navigation buttons
    const prevBtn = document.getElementById('prevTestimonial');
    const nextBtn = document.getElementById('nextTestimonial');
    
    if (prevBtn) prevBtn.disabled = testimonials.length <= 1;
    if (nextBtn) nextBtn.disabled = testimonials.length <= 1;
    
    // Update dots
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentTestimonialIndex);
    });
}

function goToTestimonial(index) {
    currentTestimonialIndex = index;
    updateTestimonials();
    restartTestimonialTimer();
}

// Auto-advance testimonials with visibility management
function startTestimonialTimer() {
    if (testimonialTimer) return;
    
    testimonialTimer = setInterval(() => {
        const nextBtn = document.getElementById('nextTestimonial');
        if (nextBtn && !nextBtn.disabled && translations[currentLanguage].testimonials.items.length > 1) {
            nextBtn.click();
        }
    }, 5000);
}

function stopTestimonialTimer() {
    if (testimonialTimer) {
        clearInterval(testimonialTimer);
        testimonialTimer = null;
    }
}

function restartTestimonialTimer() {
    stopTestimonialTimer();
    startTestimonialTimer();
}

// Stop/start timer based on page visibility
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopTestimonialTimer();
    } else {
        startTestimonialTimer();
    }
});

// Enhanced Carousel functionality
function initializeCarousel() {
    const carousel = document.getElementById('travelCarousel');
    if (!carousel) return;

    const imgs = [...carousel.querySelectorAll('.carousel-img')];
    const prev = carousel.querySelector('.pc-prev');
    const next = carousel.querySelector('.pc-next');
    const capText = carousel.querySelector('.pc-text');
    const counter = carousel.querySelector('.pc-counter');

    let i = 0;
    let timer = null;
    const DURATION = 3000;

    function update() {
        imgs.forEach((img, idx) => {
            const active = idx === i;
            img.classList.toggle('active', active);
            img.setAttribute('aria-hidden', active ? 'false' : 'true'); // Accessibility
        });
        
        const caption = imgs[i].dataset.caption || imgs[i].alt || '';
        if (capText) capText.textContent = caption;
        if (counter) counter.textContent = `${i + 1}/${imgs.length}`;
        
        // Update aria-labels based on current language
        const lang = currentLanguage || 'pt';
        if (prev) prev.setAttribute('aria-label', lang === 'pt' ? 'Anterior' : lang === 'fr' ? 'Précédent' : 'Previous');
        if (next) next.setAttribute('aria-label', lang === 'pt' ? 'Seguinte' : lang === 'fr' ? 'Suivant' : 'Next');
    }

    function nextSlide() { i = (i + 1) % imgs.length; update(); }
    function prevSlide() { i = (i - 1 + imgs.length) % imgs.length; update(); }

    function start() { stop(); timer = setInterval(nextSlide, DURATION); }
    function stop() { if (timer) clearInterval(timer); }

    if (next) next.addEventListener('click', () => { nextSlide(); start(); });
    if (prev) prev.addEventListener('click', () => { prevSlide(); start(); });

    carousel.addEventListener('mouseenter', stop);
    carousel.addEventListener('mouseleave', start);

    // Optimize first image for LCP
    if (imgs[0]) {
        imgs.loading = 'eager';
        imgs.fetchPriority = 'high';
    }

    // Wrap images in links for new tab opening
    imgs.forEach(img => {
        if (!img.parentElement.matches('a')) {
            const link = document.createElement('a');
            link.href = img.src;
            link.target = '_blank';
            link.rel = 'noopener';
            img.parentNode.insertBefore(link, img);
            link.appendChild(img);
        }
    });

    update();
    start();
}

// Enhanced Quote form with tracking
function openQuoteForm() {
    // Track click event
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 
        event: 'click_quote_cta', 
        lang: currentLanguage || 'pt',
        source: 'website_form'
    });
    
    // Small delay for tracking, then open
    setTimeout(() => {
        window.open('https://www.icligo.com/forms/pt/contact-us/book-your-trip?utm_source=LHw8s4N4', '_blank', 'noopener');
    }, 150);
}

// Contact tracking initialization
function initializeContactTracking() {
    // Track contact method clicks (WhatsApp, Email, Phone)
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="https://wa.me/"], a[href^="mailto:"], a[href^="tel:"]');
        if (!link) return;

        window.dataLayer = window.dataLayer || [];
        const href = link.href;
        const type = href.startsWith('https://wa.me/') ? 'click_whatsapp' :
                     href.startsWith('mailto:') ? 'click_email' : 'click_call';
        
        window.dataLayer.push({ 
            event: type, 
            href: href,
            lang: currentLanguage || 'pt'
        });
    });
}

// Enhanced smooth scrolling with header adjustment
function smoothScroll() {
    window.addEventListener('scroll', function() {
        const header = document.querySelector('.header');
        if (!header) return;
        
        if (window.scrollY > 100) {
            header.style.background = 'rgba(255, 255, 255, 0.95)';
        } else {
            header.style.background = 'rgba(255, 255, 255, 0.9)';
        }
    });
}

// Initialize smooth scroll
smoothScroll();

// Performance optimization: Intersection Observer for lazy loading
function initializeIntersectionObserver() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                }
            });
        });

        // Observe images with data-src
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
}

// Initialize intersection observer
initializeIntersectionObserver();

// Error handling
window.addEventListener('error', function(e) {
    console.warn('Travel Frontiers: Script error handled', e.error);
    // Don't break the user experience for non-critical errors
});

// Prevent memory leaks on page unload
window.addEventListener('beforeunload', function() {
    stopTestimonialTimer();
});
