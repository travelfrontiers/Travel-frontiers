class TfPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.data = {};
  }

  set data(value) {
    this._data = value || {};
    this.render();
  }

  get data() {
    return this._data;
  }

  render() {
    if (!this._data) return;

    // Determina o formato (default = banner)
    const formatClass = `format-${this._data.format || 'banner'}`;

    // Limpa classes antigas e aplica a nova
    this.className = '';
    this.classList.add(formatClass);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: sans-serif;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          background: #fff;
        }

        .promo-card {
          display: flex;
          flex-direction: column;
        }

        img.bg {
          width: 100%;
          object-fit: cover;
          display: block;
        }

        /* Banner (horizontal) */
        :host(.format-banner) img.bg {
          height: 260px;
        }

        /* Story (vertical) */
        :host(.format-story) {
          max-width: 320px;
        }

        :host(.format-story) img.bg {
          aspect-ratio: 9 / 16;
          height: auto;
        }

        .content {
          padding: 1rem;
        }

        .content h3 {
          margin: 0 0 0.5rem;
          font-size: 1.2rem;
        }

        .content p {
          margin: 0;
          font-size: 0.95rem;
          color: #555;
        }
      </style>

      <div class="promo-card">
        <img class="bg" src="${this._data.image || ''}" alt="${this._data.title || ''}">
        <div class="content">
          <h3>${this._data.title || ''}</h3>
          <p>${this._data.description || ''}</p>
        </div>
      </div>
    `;
  }
}

customElements.define('tf-promo-card', TfPromoCard);
