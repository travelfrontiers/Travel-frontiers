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

    this.shadow
