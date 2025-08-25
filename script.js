// Multi-language data
const translations = { /* ... mantém o objeto translations tal como estava ... */ };

// Global variables
let currentLanguage = 'pt';
let currentTestimonialIndex = 0;

// Renderização da secção de Serviços
function renderServices() {
  const servicesGrid = document.querySelector('.services-grid');
  if (!servicesGrid) return;

  const services = translations[currentLanguage].services.items;
  servicesGrid.innerHTML = services.map(service => {
    // Gera picture element se for imagem local, senão img simples
    let imageHtml;
    if (service.image.startsWith('img/')) {
      const base = service.image.replace(/\.(jpeg|jpg|png)$/i, '');
      const ext = service.image.split('.').pop();
      imageHtml = `
        <picture>
          <source srcset="${base}.webp" type="image/webp">
          <source srcset="${service.image}" type="image/${ext}">
          <img src="${service.image}" alt="${service.title}" loading="lazy" class="clickable-service">
        </picture>
      `;
    } else {
      imageHtml = `<img src="${service.image}" alt="${service.title}" loading="lazy" class="clickable-service">`;
    }

    return `
      <div class="service-card">
        <div class="service-image">
          ${imageHtml}
          <div class="service-overlay"></div>
          <h3 class="service-title">${service.title}</h3>
        </div>
        <div class="service-content">
          <p class="service-description">${service.description}</p>
        </div>
      </div>
    `;
  }).join('');

  // Depois de injetar, configura o lightbox
  setupLightbox();
}

// Setup do Lightbox
function setupLightbox() {
  const lightbox = document.getElementById('lightbox');
  const imgElem = lightbox?.querySelector('img');
  const closeBtn = lightbox?.querySelector('.lightbox-close');
  if (!lightbox || !imgElem || !closeBtn) return;

  let scale = 1, tx = 0, ty = 0, startX, startY, dragging = false;

  function closeLB() {
    lightbox.classList.remove('show');
    imgElem.src = '';
    imgElem.style.transform = 'translate(0,0) scale(1)';
    scale = 1; tx = 0; ty = 0;
    document.body.style.overflow = '';
  }

  function openLB(src, alt) {
    imgElem.src = src;
    imgElem.alt = alt || '';
    lightbox.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  // Remove listeners anteriores e adiciona de novo
  const newClose = closeBtn.cloneNode(true);
  closeBtn.replaceWith(newClose);
  newClose.addEventListener('click', closeLB);
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLB();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lightbox.classList.contains('show')) {
      closeLB();
    }
  });

  // Zoom
  lightbox.addEventListener('wheel', e => {
    if (!lightbox.classList.contains('show')) return;
    e.preventDefault();
    scale = Math.min(Math.max(0.5, scale + (e.deltaY < 0 ? 0.2 : -0.2)), 5);
    imgElem.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  });

  // Drag
  imgElem.addEventListener('mousedown', e => {
    if (scale <= 1) return;
    dragging = true;
    startX = e.clientX - tx;
    startY = e.clientY - ty;
    imgElem.style.cursor = 'grabbing';
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    tx = e.clientX - startX;
    ty = e.clientY - startY;
    imgElem.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  });
  document.addEventListener('mouseup', () => {
    dragging = false;
    imgElem.style.cursor = 'grab';
  });

  // Abre lightbox ao clicar nas imagens de serviço
  document.querySelectorAll('.service-image .clickable-service').forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => openLB(img.src, img.alt));
  });
}

// Tradução de conteúdo
function updateContent() {
  document.querySelectorAll('[data-translate]').forEach(el => {
    const key = el.getAttribute('data-translate');
    const translation = key.split('.').reduce((obj, k) => obj?.[k], translations[currentLanguage]);
    if (translation) el.textContent = translation;
  });
}

// Inicializadores diversos
function initializeLanguageSelector() {
  const btn = document.getElementById('currentLang'), dd = document.getElementById('langDropdown');
  btn?.addEventListener('click', () => dd.classList.toggle('show'));
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !dd.contains(e.target)) dd.classList.remove('show');
  });
}
function changeLanguage(lang) {
  currentLanguage = lang;
  document.getElementById('langCode').textContent = lang.toUpperCase();
  document.documentElement.lang = lang;
  setupAfterLanguageChange();
}
function setupAfterLanguageChange() {
  updateContent();
  renderServices();
  initializeTestimonials();
}
function initializeMobileMenu() {
  const btn = document.getElementById('mobileMenuBtn'), menu = document.getElementById('mobileMenu');
  btn?.addEventListener('click', () => {
    menu.classList.toggle('show');
    btn.classList.toggle('active');
  });
  menu?.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => {
      menu.classList.remove('show');
      btn.classList.remove('active');
    })
  );
}
function initializeNavigation() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.getElementById(link.getAttribute('href').slice(1));
      if (target) {
        const offset = document.querySelector('.header')?.offsetHeight || 0;
        window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
      }
    });
  });
}

// Testemunhos
function initializeTestimonials() {
  const prev = document.getElementById('prevTestimonial'), next = document.getElementById('nextTestimonial');
  const items = translations[currentLanguage].testimonials.items;

  function update() {
    const t = items[currentTestimonialIndex];
    document.getElementById('currentTestimonial').textContent = `"${t.text}"`;
    document.getElementById('currentAuthor').textContent = t.author;
    document.getElementById('currentLocation').textContent = t.location;
    document.querySelectorAll('.dot').forEach((dot, i) =>
      dot.classList.toggle('active', i === currentTestimonialIndex)
    );
  }
  document.getElementById('testimonialDots').innerHTML = items.map((_, i) =>
    `<div class="dot${i===currentTestimonialIndex?' active':''}" onclick="goToTestimonial(${i})"></div>`
  ).join('');

  prev.disabled = items.length <= 1;
  next.disabled = items.length <= 1;
  prev.addEventListener('click', () => {
    currentTestimonialIndex = (currentTestimonialIndex - 1 + items.length) % items.length;
    update();
  });
  next.addEventListener('click', () => {
    currentTestimonialIndex = (currentTestimonialIndex + 1) % items.length;
    update();
  });
  update();
}
function goToTestimonial(i) {
  currentTestimonialIndex = i;
  initializeTestimonials();
}

// Quote form
function openQuoteForm() {
  window.open('https://www.icligo.com/forms/pt/contact-us/book-your-trip?utm_source=LHw8s4N4', '_blank');
}

// Scroll header
window.addEventListener('scroll', () => {
  document.querySelector('.header').classList.toggle('scrolled', window.scrollY > 100);
});

// Auto rotate testimonials
setInterval(() => {
  document.getElementById('nextTestimonial')?.click();
}, 5000);

// Carousel de fotos
function initCarousel() {
  const carousel = document.getElementById('travelCarousel');
  if (!carousel) return;
  const imgs = [...carousel.querySelectorAll('.carousel-container .carousel-img')];
  const prev = carousel.querySelector('.pc-prev'), next = carousel.querySelector('.pc-next');
  const cap = carousel.querySelector('.pc-text'), ctr = carousel.querySelector('.pc-counter');
  let i = 0, timer;

  function update() {
    imgs.forEach((img, idx) => img.classList.toggle('active', idx === i));
    cap.textContent = imgs[i].dataset.caption || imgs[i].alt;
    ctr.textContent = `${i+1}/${imgs.length}`;
  }
  function start() {
    timer = setInterval(() => { i = (i+1)%imgs.length; update(); }, 3000);
  }
  function stop() { clearInterval(timer); }

  prev.addEventListener('click', () => { i = (i-1+imgs.length)%imgs.length; update(); start(); });
  next.addEventListener('click', () => { i = (i+1)%imgs.length; update(); start(); });
  carousel.addEventListener('mouseenter', stop);
  carousel.addEventListener('mouseleave', start);
  update(); start();
}

// Inicialização no DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  initializeLanguageSelector();
  initializeMobileMenu();
  initializeNavigation();
  initializeTestimonials();
  renderServices();
  updateContent();
  initCarousel();
});
