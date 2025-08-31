class TfPromoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._data = {};
  }

  set data(value) {
    this._data = value;
    this.render();
  }

  render() {
    if (!this._data) return;

    const meta = [
      this._data.origin,
      this._data.startdate && this._data.enddate
        ? `${this._data.startdate} - ${this._data.enddate}`
        : ''
    ].filter(Boolean).join(' | ');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          font-family: Arial, sans-serif;
          color: #fff;
          overflow: hidden;
          border-radius: 8px;
        }
        .card {
          position: relative;
          width: 100%;
          height: 100%;
        }
        img {
          width: 100%;
          height: auto;
          display: block;
        }
        .overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 16px;
          background: linear-gradient(
            to top,
            rgba(0,0,0,0.75) 20%,
            rgba(0,0,0,0) 60%,
            rgba(0,0,0,0.75) 100%
          );
        }
        .top {
          display: flex;
          justify-content: flex-start;
        }
        .badge {
          background: var(--tf-color-primary, #ffcc00);
          color: #000;
          padding: 4px 8px;
          font-size: 0.85rem;
          font-weight: bold;
          border-radius: 4px;
        }
        .bottom {
          display: flex;
          flex-direction: column;
        }
        .title {
          font-size: 2rem;
          font-weight: 900;
          text-transform: uppercase;
          margin: 0 0 6px;
        }
        .subtitle {
          font-size: 1rem;
          margin: 0 0 6px;
        }
        .meta, .includes {
          font-size: 0.9rem;
          margin: 0 0 4px;
        }
        .highlight {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
        }
        .price {
          font-size: 1.3rem;
          font-weight: 900;
          background: var(--tf-color-primary, #ffcc00);
          color: #000;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .hotel {
          font-size: 1rem;
          font-weight: bold;
        }
        .logo {
          position: absolute;
          bottom: 16px;
          right: 16px;
          max-width: 60px;
          max-height: 40px;
          object-fit: contain;
          filter: drop-shadow(0 0 4px rgba(0,0,0,0.5));
        }
      </style>
      <div class="card">
        ${this._data.image ? `<img src="${this._data.image}" alt="${this._data.destination || ''}">` : ''}
        <div class="overlay">
          <div class="top">
            ${this._data['badge-text'] ? `<span class="badge">${this._data['badge-text']}</span>` : ''}
          </div>
          <div class="bottom">
            ${this._data.destination ? `<h3 class="title">${this._data.destination}</h3>` : ''}
            ${this._data.subtitle ? `<p class="subtitle">${this._data.subtitle}</p>` : ''}
            ${meta ? `<p class="meta">${meta}</p>` : ''}
            ${this._data.includes ? `<p class="includes">${this._data.includes}</p>` : ''}
            <div class="highlight">
              ${this._data.price ? `<span class="price">${this._data.price}</span>` : ''}
              ${this._data.hotel ? `<span class="hotel">${this._data.hotel}</span>` : ''}
            </div>
          </div>
        </div>
        ${this._data.logo ? `<img class="logo" src="${this._data.logo}" alt="logo">` : ''}
      </div>
    `;
  }
}

customElements.define('tf-promo-card', TfPromoCard);
