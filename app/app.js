document.addEventListener('DOMContentLoaded', function() {
    // Elementos
    const canvas = document.getElementById('canvas');
    const promoElement = document.getElementById('promo_element');
    const destinationElement = document.getElementById('destination_element');
    const descriptionElement = document.getElementById('description_element');
    const infoElement = document.getElementById('info_element');
    const logoElement = document.getElementById('logo_element');

    // Textos
    const promoText = document.getElementById('promo_text');
    const destinationText = document.getElementById('destination_text');
    const descriptionText = document.getElementById('description_text');
    const flightText = document.getElementById('flight_text');
    const servicesText = document.getElementById('services_text');
    const hotelText = document.getElementById('hotel_text');
    const priceText = document.getElementById('price_text');
    const noteText = document.getElementById('note_text');

    // Controlo Global de Fonte
    const globalFontSelect = document.getElementById('global_font_family');
    if (globalFontSelect) {
        globalFontSelect.addEventListener('change', function() {
            const selectedFont = this.value;
            if (canvas) canvas.style.fontFamily = selectedFont;
            document.body.style.fontFamily = selectedFont;
        });
    }

    // Função para atualizar valores em tempo real
    function updateValue(elementId, value, suffix = '') {
        const element = document.getElementById(elementId);
        if (element) element.textContent = value + suffix;
    }

    // Função para atualizar preview de imagem/logo
    function updateImagePreview(input, previewId, targetElement) {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imageUrl = e.target.result;
                    const preview = document.getElementById(previewId);
                    if (preview) preview.style.backgroundImage = `url(${imageUrl})`;

                    if (targetElement === 'background' && canvas) {
                        canvas.style.backgroundImage = `url(${imageUrl})`;
                    } else if (targetElement === 'logo' && logoElement) {
                        logoElement.src = imageUrl;
                        logoElement.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Setups das imagens
    const bgInput = document.getElementById('background_image');
    const logoInput = document.getElementById('logo_image');
    if (bgInput) updateImagePreview(bgInput, 'bg-preview', 'background');
    if (logoInput) updateImagePreview(logoInput, 'logo-preview', 'logo');

    // Tamanho do logo
    const logoSize = document.getElementById('logo_size');
    if (logoSize && logoElement) {
        logoSize.addEventListener('input', function() {
            updateValue('logo_size_value', this.value, 'px');
            logoElement.style.width = this.value + 'px';
        });
    }

    // Controlo dos textos
    const textControls = [
        { input: 'promo_tag', output: promoText },
        { input: 'destination', output: destinationText },
        { input: 'description', output: descriptionText },
        { input: 'flight_info', output: flightText },
        { input: 'services_info', output: servicesText },
        { input: 'hotel_name', output: hotelText },
        { input: 'price', output: priceText },
        { input: 'price_note', output: noteText }
    ];

    textControls.forEach(control => {
        const input = document.getElementById(control.input);
        if (input && control.output) {
            control.output.textContent = input.value ?? '';
            input.addEventListener('input', function() {
                control.output.textContent = this.value;
            });
        }
    });

    // Controlo de cores de texto
    const colorControls = [
        { input: 'promo_tag_color', target: promoElement, property: 'color' },
        { input: 'destination_color', target: destinationText, property: 'color' },
        { input: 'description_color', target: descriptionText, property: 'color' }
    ];

    colorControls.forEach(control => {
        const input = document.getElementById(control.input);
        if (input && control.target) {
            input.addEventListener('input', function() {
                control.target.style[control.property] = this.value;
            });
            if (input.value) {
                control.target.style[control.property] = input.value;
            }
        }
    });

    // Controlo de tamanhos de texto
    const sizeControls = [
        { input: 'promo_tag_size', target: promoText, valueElement: 'promo_tag_size_value', unit: 'rem' },
        { input: 'destination_size', target: destinationText, valueElement: 'destination_size_value', unit: 'rem' },
        { input: 'description_size', target: descriptionText, valueElement: 'description_size_value', unit: 'rem' }
    ];

    sizeControls.forEach(control => {
        const input = document.getElementById(control.input);
        if (input && control.target) {
            input.addEventListener('input', function() {
                updateValue(control.valueElement, this.value, control.unit);
                control.target.style.fontSize = this.value + control.unit;
            });
            if (input.value) {
                updateValue(control.valueElement, input.value, control.unit);
                control.target.style.fontSize = input.value + control.unit;
            }
        }
    });

    // ---------- CONTROLO DE TRANSPARÊNCIA CORRIGIDO PARA EXPORTAÇÃO ----------
    // Esta função aplica apenas background rgba, nunca opacity!
    function setBackgroundAlpha(element, color, alpha) {
        if (!element) return;
        let r = 255, g = 255, b = 255;
        if (color.startsWith('#') && color.length === 7) {
            r = parseInt(color.substring(1, 3), 16);
            g = parseInt(color.substring(3, 5), 16);
            b = parseInt(color.substring(5, 7), 16);
        }
        element.style.background = `rgba(${r},${g},${b},${alpha})`;
    }

    const alphaControls = [
  { input: 'promo_tag_alpha', target: promoElement, valueElement: 'promo_tag_alpha_value', color: '#CA9524' }, // <- Dourado!
  { input: 'description_bg_alpha', target: descriptionElement, valueElement: 'description_bg_alpha_value', color: '#fffbe8' },
  { input: 'info_box_alpha', target: infoElement, valueElement: 'info_box_alpha_value', color: '#fffbe8' }
];

    alphaControls.forEach(control => {
        const input = document.getElementById(control.input);
        if (input && control.target) {
            input.addEventListener('input', function() {
                const alpha = this.value / 100;
                updateValue(control.valueElement, this.value, '%');
                if (+this.value === 0) {
                    control.target.style.display = 'none';
                } else {
                    control.target.style.display = 'block';
                    setBackgroundAlpha(control.target, control.color, alpha);
                }
            });
            if (input.value !== undefined) {
                const alpha = input.value / 100;
                updateValue(control.valueElement, input.value, '%');
                setBackgroundAlpha(control.target, control.color, alpha);
            }
        }
    });

    // -------- SISTEMA DE TEMPLATES --------
function saveTemplate() {
    const template = {
        promo_tag: document.getElementById('promo_tag')?.value || '',
        promo_tag_color: document.getElementById('promo_tag_color')?.value || '#ffffff',
        promo_tag_size: document.getElementById('promo_tag_size')?.value || '1.2',
        promo_tag_alpha: document.getElementById('promo_tag_alpha')?.value || '100',
        destination: document.getElementById('destination')?.value || '',
        destination_color: document.getElementById('destination_color')?.value || '#2c3e50',
        destination_size: document.getElementById('destination_size')?.value || '4.2',
        description: document.getElementById('description')?.value || '',
        description_color: document.getElementById('description_color')?.value || '#2c3e50',
        description_size: document.getElementById('description_size')?.value || '1.1',
        description_bg_alpha: document.getElementById('description_bg_alpha')?.value || '65',
        flight_info: document.getElementById('flight_info')?.value || '',
        services_info: document.getElementById('services_info')?.value || '',
        hotel_name: document.getElementById('hotel_name')?.value || '',
        price: document.getElementById('price')?.value || '',
        price_note: document.getElementById('price_note')?.value || '',
        info_box_alpha: document.getElementById('info_box_alpha')?.value || '90',
        global_font_family: document.getElementById('global_font_family')?.value || "'Montserrat', sans-serif",
        logo_size: document.getElementById('logo_size')?.value || '100'
    };
    
    localStorage.setItem('travel_frontiers_template', JSON.stringify(template));
    alert('✅ Template guardado com sucesso!');
}

function loadTemplate() {
    const saved = localStorage.getItem('travel_frontiers_template');
    if (!saved) {
        alert('❌ Não há template guardado!');
        return;
    }
    
    const template = JSON.parse(saved);
    
    Object.keys(template).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            element.value = template[key];
            
            // Disparar evento change para atualizar preview
            element.dispatchEvent(new Event('input'));
            element.dispatchEvent(new Event('change'));
        }
    });
    
    alert('✅ Template carregado com sucesso!');
}

const saveTemplateBtn = document.getElementById('save_template_btn');
const loadTemplateBtn = document.getElementById('load_template_btn');

if (saveTemplateBtn) saveTemplateBtn.addEventListener('click', saveTemplate);
if (loadTemplateBtn) loadTemplateBtn.addEventListener('click', loadTemplate);


   // -------- EXPORTAÇÃO --------
const exportBtn = document.getElementById('export_btn');
if (exportBtn && canvas) {
    exportBtn.addEventListener('click', function() {
        exportBtn.textContent = '⏳ Gerando imagem...';
        exportBtn.disabled = true;

        const originalTransform = canvas.style.transform;
        canvas.style.transform = 'scale(1)';

        // NOVO: Remover sombras temporariamente para exportação limpa
        const elementsWithShadows = canvas.querySelectorAll('.description-box, .info-box, .promo-tag');
        const originalShadows = [];
        
        elementsWithShadows.forEach((el, index) => {
            originalShadows[index] = el.style.boxShadow;
            el.style.boxShadow = 'none';
        });

        setTimeout(() => {
            html2canvas(canvas, {
                width: 1080,
                height: 1350,
                scale: 1,
                useCORS: true,
                backgroundColor: null,
                allowTaint: true
            }).then(function(capturedCanvas) {
                // Restaurar tudo ao estado original
                canvas.style.transform = originalTransform;
                elementsWithShadows.forEach((el, index) => {
                    el.style.boxShadow = originalShadows[index];
                });

                const link = document.createElement('a');
                link.download = 'instagram-post-travel-frontiers.png';
                link.href = capturedCanvas.toDataURL('image/png', 1.0);
                link.click();

                exportBtn.textContent = '💾 Exportar Imagem (1080×1350)';
                exportBtn.disabled = false;
            }).catch(function(error) {
                console.error('Erro ao exportar:', error);
                canvas.style.transform = originalTransform;
                elementsWithShadows.forEach((el, index) => {
                    el.style.boxShadow = originalShadows[index];
                });
                exportBtn.textContent = '❌ Erro - Tentar novamente';
                exportBtn.disabled = false;
            });
        }, 100);
    });
}

// -------- INICIALIZAÇÃO DO PREVIEW --------
function initializePreview() {
    // Textos
    if (promoText) promoText.textContent = 'LAST CALL';
    if (destinationText) destinationText.textContent = 'MARROCOS';
    if (descriptionText) descriptionText.textContent = 'Descubra Marrocos numa escapadinha exclusiva de 4 dias, com voos diretos e todos os detalhes tratados para si.';
    if (flightText) flightText.textContent = 'VOOS DIRETOS LISBOA | 20 A 23 SETEMBRO';
    if (servicesText) servicesText.textContent = 'TRANSFERES PRIVADOS | SEGURO';
    if (hotelText) hotelText.textContent = 'Ibn Batouta';
    if (priceText) priceText.textContent = '290€';
    if (noteText) noteText.textContent = '*';
    
    // Cores
    if (promoElement) promoElement.style.color = '#ffffff';
    if (destinationText) destinationText.style.color = '#2c3e50';
    if (descriptionText) descriptionText.style.color = '#2c3e50';
    
    // Tamanhos
    if (promoText) promoText.style.fontSize = '1.2rem';
    if (destinationText) destinationText.style.fontSize = '4.2rem';
    if (descriptionText) descriptionText.style.fontSize = '1.1rem';
    
    // CRUCIAL: Fundos das caixas (isso estava a faltar!)
    if (promoElement) {
        promoElement.style.background = '#CA9524';
        promoElement.style.display = 'block';
    }
    if (descriptionElement) {
        descriptionElement.style.background = 'rgba(255,251,232,0.65)';
        descriptionElement.style.display = 'block';
    }
    if (infoElement) {
        infoElement.style.background = 'rgba(255,251,232,0.9)';
        infoElement.style.display = 'block';
    }

    initializePreview();
    
    console.log('✅ Preview inicializado com sucesso!');
}


    console.log('✅ Gerador Instagram carregado!');
});
