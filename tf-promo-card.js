// tf-promo-code.js
// Mantém a lógica original, apenas corrige carregamento e robustez

document.addEventListener('DOMContentLoaded', () => {
  carregarPromocoes('promo.json');
});

async function carregarPromocoes(url) {
  const container = document.querySelector('#promocoes');
  if (!container) {
    console.error('Elemento #promocoes não encontrado no HTML.');
    return;
  }

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status} ao carregar ${url}`);
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.warn('promo.json está vazio ou não é um array.');
      container.innerHTML = '<p>Sem promoções disponíveis.</p>';
      return;
    }

    data.forEach(item => {
      const card = document.createElement('tf-promo-card');
      card.data = item;
      container.appendChild(card);
    });

  } catch (err) {
    console.error('Erro ao carregar promoções:', err);
    container.innerHTML = '<p style="color:#c00">Não foi possível carregar as promoções.</p>';
  }
}
