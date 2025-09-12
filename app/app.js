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
    
    // NOVO: Controlo Global de Fonte
    const globalFontSelect = document.getElementById('global_font_family');
    if (globalFontSelect) {
        globalFontSelect.addEventListener('change', function() {
            const selectedFont = this.value;
            // Aplicar fonte a todos os elementos de texto
            canvas.style.fontFamily = selectedFont;
            document.body.style.fontFamily = selectedFont;
        });
    }
    
    // Função para atualizar valores em tempo real
    function updateValue(elementId, value, suffix = '') {
        const element = document.getElementById(elementId);
        if (element) element.textContent = value + suffix;
    }
    
    // Função para atualizar preview de imagem
    function updateImagePreview(input, previewId, targetElement) {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imageUrl = e.target.result;
                    
                    // Atualizar preview thumb
                    const preview = document.getElementById(previewId);
                    if (preview) {
                        preview.style.backgroundImage = `url(${imageUrl})`;
                    }
                    
                    // Atualizar elemento no canvas
                    if (targetElement === 'background') {
                        canvas.style.backgroundImage = `url(${imageUrl})`;
                    } else if (targetElement === 'logo') {
                        logoElement.src = imageUrl;
                        logoElement.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Setup uploads
    const bgInput = document.getElementById('background_image');
    const logoInput = document.getElementById('logo_image');
    
    if (bgInput) updateImagePreview(bgInput, 'bg-preview', 'background');
    if (logoInput) updateImagePreview(logoInput, 'logo-preview', 'logo');
    
    // Controle de tamanho do logo
    const logoSize = document.getElementById('logo_size');
    if (logoSize) {
        logoSize.addEventListener('input', function() {
            updateValue('logo_size_value', this.value, 'px');
            logoElement.style.width = this.value + 'px';
        });
    }
    
    // Controles de texto
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
            // Inicial
            control.output.textContent = input.value;
            // Em tempo real
            input.addEventListener('input', function() {
                control.output.textContent = this.value;
            });
        }
    });
    
    // Controles de cor
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
            // Aplicar cor inicial
            control.target.style[control.property] = input.value;
        }
    });
    
    // Controles de tamanho
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
            // Aplicar tamanho inicial
            updateValue(control.valueElement, input.value, control.unit);
            control.target.style.fontSize = input.value + control.unit;
        }
    });
    
    // Controles de transparência
    const alphaControls = [
        { input: 'promo_tag_alpha', target: promoElement, valueElement: 'promo_tag_alpha_value' },
        { input: 'description_bg_alpha', target: descriptionElement, valueElement: 'description_bg_alpha_value' },
        { input: 'info_box_alpha', target: infoElement, valueElement: 'info_box_alpha_value' }
    ];
    
    alphaControls.forEach(control => {
        const input = document.getElementById(control.input);
        if (input && control.target) {
            input.addEventListener('input', function() {
                const alpha = this.value / 100;
                updateValue(control.valueElement, this.value, '%');
                
                if (this.value == 0) {
                    control.target.style.display = 'none';
                } else {
                    control.target.style.display = 'block';
                    control.target.style.opacity = alpha;
                }
            });
            // Aplicar transparência inicial
            const alpha = input.value / 100;
            updateValue(control.valueElement, input.value, '%');
            control.target.style.opacity = alpha;
        }
    });
    
    // NOVO: Função de Export Corrigida - Captura o canvas sem scale
    const exportBtn = document.getElementById('export_btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            exportBtn.textContent = '⏳ Gerando imagem...';
            exportBtn.disabled = true;
            
            // Remover temporariamente o scale para captura
            const originalTransform = canvas.style.transform;
            canvas.style.transform = 'scale(1)';
            
            // Aguardar um momento para o CSS aplicar
            setTimeout(() => {
                html2canvas(canvas, {
                    width: 1080,
                    height: 1350,
                    scale: 1,
                    useCORS: true,
                    backgroundColor: null,
                    allowTaint: true
                }).then(function(capturedCanvas) {
                    // Restaurar o transform original
                    canvas.style.transform = originalTransform;
                    
                    // Download da imagem
                    const link = document.createElement('a');
                    link.download = 'instagram-post-travel-frontiers.png';
                    link.href = capturedCanvas.toDataURL('image/png', 1.0);
                    link.click();
                    
                    // Restaurar botão
                    exportBtn.textContent = '💾 Exportar Imagem (1080×1350)';
                    exportBtn.disabled = false;
                }).catch(function(error) {
                    console.error('Erro ao exportar:', error);
                    canvas.style.transform = originalTransform;
                    exportBtn.textContent = '❌ Erro - Tentar novamente';
                    exportBtn.disabled = false;
                });
            }, 100);
        });
    }
    
    console.log('✅ Gerador Instagram carregado!');
});
