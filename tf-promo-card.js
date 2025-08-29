// 1. Carregar promoções do JSON e criar os elementos
fetch('promo.json')
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById('promocoes');
    data.forEach(item => {
      const card = document.createElement('tf-promo-card');
      Object.entries(item).forEach(([key, value]) => {
        if (value) card.setAttribute(key, value);
      });
      container.appendChild(card);
    });
  })
  .catch(err => console.error('Erro a carregar promoções:', err));


// 2. Definir o Web Component
class TfPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const format = this.getAttribute('format') || '';
    const imageSrc = this.getAttribute('image-src') || '';
    const imageAlt = this.getAttribute('image-alt') || '';
    const badgeText = this.getAttribute('badge-text') || '';
    const destination = this.getAttribute('destination') || '';
    const subtitle = this.getAttribute('subtitle') || '';
    const origin = this.getAttribute('origin') || '';
    const dates = this.getAttribute('dates') || '';
    const includes = this.getAttribute('includes') || '';
    const hotel = this.getAttribute('hotel') || '';
    const price = this.getAttribute('price') || '';
    const currency = this.getAttribute('currency') || '';
    const logoSrc = this.getAttribute('logo-src') || '';
    const link = this.getAttribute('link') || '#';

    this.shadowRoot.innerHTML = `
      <style>${this.getCss()}</style>
      <a class="card format-${format}" href="${link}">
        <div class="image">
          <img src="${imageSrc}" alt="${imageAlt}">
          ${badgeText ? `<div class="badge">${badgeText}</div>` : ''}
          <div class="overlay">
            ${destination ? `<h3 class="title">${destination}</h3>` : ''}
            ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
            ${origin ? `<p class="origin">${origin}</p>` : ''}
            ${dates ? `<p class="dates">${dates}</p>` : ''}
            ${includes ? `<p class="includes">${includes}</p>` : ''}
            ${hotel ? `<p class="hotel">${hotel}</p>` : ''}
            ${price ? `<span class="price">${price}${currency || ''}</span>` : ''}
          </div>
          ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="Logo">` : ''}
        </div>
      </a>
    `;
  }

  getCss() {
    /* Aqui colocas o CSS completo que já te passei */
    return `/* ... */`;
  }
}

customElements.define('tf-promo-card', TfPromoCard);
