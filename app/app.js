document.addEventListener('DOMContentLoaded', function() {
    
    // Elementos do preview
    const canvas = document.getElementById('canvas');
    const promoElement = document.getElementById('promo_element');
    const destinationElement = document.getElementById('destination_element');
    const descriptionElement = document.getElementById('description_element');
    const infoElement = document.getElementById('info_element');
    const logoElement = document.getElementById('logo_element');
    
    // Elementos do export canvas
    const exportCanvas = document.getElementById('export-canvas');
    const exportPromo = document.getElementById('export-promo');
    const exportDestination = document.getElementById('export-destination');
    const exportDescription = document.getElementById('export-description');
    const exportInfo = document.getElementById('export-info');
    const exportLogo = document.getElementById('export-logo');
    
    // Textos do preview
    const promoText = document.getElementById('promo_text');
    const destinationText = document.getElementById('destination_text');
    const descriptionText = document.getElementById('description_text');
    const flightText = document.getElementById('flight_text');
    const servicesText = document.getElementById('services_text');
    const hotelText = document.getElementById('hotel_text');
    const priceText = document.getElementById('price_text');
    const noteText = document.getElementById('note_text');
    
    // Textos do export
    const exportPromoText = document.getElementById('export-promo-text');
    const exportDestinationText = document.getElementById('export-destination-text');
    const exportDescriptionText = document.getElementById('export-description-text');
    const exportFlightText = document.getElementById('export-flight-text');
    const exportServicesText = document.getElementById('export-services-text');
    const exportHotelText = document.getElementById('export-hotel-text');
    const exportPriceText = document.getElementById('export-price-text');
    const exportNoteText = document.getElementById('export-note-text');
    
    // NOVO: Controlo Global de Fonte
    const fontFamilySelect = document.getElementById('font_family');
    if (fontFamilySelect) {
        fontFamilySelect.addEventListener('change', function() {
            document.documentElement.style.setProperty('--font-family', this.value);
        });
    }
    
    // Função para sincronizar conteúdo entre preview e export
    function syncContent() {
        // Textos
        if (exportPromoText) exportPromoText.textContent = promoText.textContent;
        if (exportDestinationText) exportDestinationText.textContent = destinationText.textContent;
        if (exportDescriptionText) exportDescriptionText.textContent = descriptionText.textContent;
        if (exportFlightText) exportFlightText.textContent = flightText.textContent;
        if (exportServicesText) exportServicesText.textContent = servicesText.textContent;
        if (exportHotelText) exportHotelText.textContent = hotelText.textContent;
        if (exportPriceText) exportPriceText.textContent = priceText.textContent;
        if (exportNoteText) exportNoteText.textContent = noteText.textContent;
        
        // Estilos
        if (exportPromo && promoElement) {
            exportPromo.style.cssText = promoElement.style.cssText;
        }
        if (exportDestination && destinationElement) {
            exportDestination.style.cssText = destinationElement.style.cssText;
        }
        if (exportDescription && descriptionElement) {
            exportDescription.style.cssText = descriptionElement.style.cssText;
        }
        if (exportInfo && infoElement) {
            exportInfo.style.cssText = infoElement.style.cssText;
        }
        
        // Background e Logo
        if (exportCanvas && canvas) {
            exportCanvas.style.backgroundImage = canvas.style.backgroundImage;
        }
        if (exportLogo && logoElement) {
            exportLogo.src = logoElement.src;
            exportLogo.style.cssText = logoElement.style.cssText;
        }
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
                        exportCanvas.style.backgroundImage = `url(${imageUrl})`; // NOVO: sync export
                    } else if (targetElement === 'logo') {
                        logoElement.src = imageUrl;
                        logoElement.style.display = 'block';
                        exportLogo.src = imageUrl; // NOVO: sync export
                        exportLogo.style.display = 'block';
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
            exportLogo.style.width = this.value + 'px'; // NOVO: sync export
        });
    }
    
    // Controles de texto
    const textControls = [
        { input: 'promo_tag', output: promoText, exportOutput: exportPromoText },
        { input: 'destination', output: destinationText, exportOutput: exportDestinationText },
        { input: 'description', output: descriptionText, exportOutput: exportDescriptionText },
        { input: 'flight_info', output: flightText, exportOutput: exportFlightText },
        { input: 'services_info', output: servicesText, exportOutput: exportServicesText },
        { input: 'hotel_name', output: hotelText, exportOutput: exportHotelText },
        { input: 'price', output: priceText, exportOutput: exportPriceText },
        { input: 'price_note', output: noteText, exportOutput: exportNoteText }
    ];
    
    textControls.forEach(control => {
        const input = document.getElementById(control.input);
        if (input && control.output) {
            // Inicial
            control.output.textContent = input.value;
            if (control.exportOutput) control.exportOutput.textContent = input.value;
            
            // Em tempo real
            input.addEventListener('input', function() {
                control.output.textContent = this.value;
                if (control.exportOutput) control.exportOutput.textContent = this.value; // NOVO: sync export
            });
        }
    });
    
    // Controles de cor
    const colorControls = [
        { input: 'promo_tag_color', target: promoElement, exportTarget: exportPromo, property: 'color' },
        { input: 'destination_color', target: destinationText, exportTarget: exportDestinationText, property: 'color' },
        { input: 'description_color', target: descriptionText, exportTarget: exportDescriptionText, property: 'color' }
    ];
    
    colorControls.forEach(control => {
        const input = document.getElementById(control.input);
        if (input && control.target) {
            input.addEventListener('input', function() {
                control.target.style[control.property] = this.value;
                if (control.exportTarget) control.exportTarget.style[control.property] = this.value; // NOVO: sync export
            });
            // Aplicar cor inicial
            control.target.style[control.property] = input.value;
            if (control.exportTarget) control.exportTarget.style[control.property] = input.value;
        }
    });
    
    // Controles de tamanho
    const sizeControls = [
        { input: 'promo_tag_size', target: promoText, exportTarget: exportPromoText, valueElement: 'promo_tag_size_value', unit: 'rem' },
        { input: 'destination_size', target: destinationText, exportTarget: exportDestinationText, valueElement: 'destination_size_value', unit: 'rem' },
        { input: 'description_size', target: descriptionText, exportTarget: exportDescriptionText, valueElement: 'description_size_value', unit: 'rem' }
    ];
    
    sizeControls.forEach(control => {
        const input = document.getElementById(control.input);
        if (input && control.target) {
            input.addEventListener('input', function() {
                updateValue(control.valueElement, this.value, control.unit);
                control.target.style.fontSize = this.value + control.unit;
                if (control.exportTarget) control.exportTarget.style.fontSize = this.value + control.unit; // NOVO: sync export
            });
            // Aplicar tamanho inicial
            updateValue(control.valueElement, input.value, control.unit);
            control.target.style.fontSize = input.value + control.unit;
            if (control.exportTarget) control.exportTarget.style.fontSize = input.value + control.unit;
        }
    });
    
    // Controles de transparência
    const alphaControls = [
        { input: 'promo_tag_alpha', target: promoElement, exportTarget: exportPromo, valueElement: 'promo_tag_alpha_value' },
        { input: 'description_bg_alpha', target: descriptionElement, exportTarget: exportDescription, valueElement: 'description_bg_alpha_value' },
        { input: 'info_box_alpha', target: infoElement, exportTarget: exportInfo, valueElement: 'info_box_alpha_value' }
    ];
    
    alphaControls.forEach(control => {
        const input = document.getElementById(control.input);
        if (input && control.target) {
            input.addEventListener('input', function() {
                const alpha = this.value / 100;
                updateValue(control.valueElement, this.value, '%');
                
                if (this.value == 0) {
                    control.target.style.display = 'none';
                    if (control.exportTarget) control.exportTarget.style.display = 'none'; // NOVO: sync export
                } else {
                    control.target.style.display = 'block';
                    control.target.style.opacity = alpha;
                    if (control.exportTarget) { // NOVO: sync export
                        control.exportTarget.style.display = 'block';
                        control.exportTarget.style.opacity = alpha;
                    }
                }
            });
            // Aplicar transparência inicial
            const alpha = input.value / 100;
            updateValue(control.valueElement, input.value, '%');
            control.target.style.opacity = alpha;
            if (control.exportTarget) control.exportTarget.style.opacity = alpha;
        }
    });
    
    // NOVO: Função de Export Corrigida
    const exportBtn = document.getElementById('export_btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            exportBtn.textContent = '⏳ Gerando imagem...';
            exportBtn.disabled = true;
            
            // Sincronizar conteúdo antes do export
            syncContent();
            
            // Mover temporariamente o export canvas para posição visível
            exportCanvas.style.position = 'fixed';
            exportCanvas.style.left = '0';
            exportCanvas.style.top = '0';
            exportCanvas.style.zIndex = '-1';
            
            html2canvas(exportCanvas, {
                width: 1080,
                height: 1350,
                scale: 1,
                useCORS: true,
                backgroundColor: null,
                logging: false
            }).then(function(canvas2) {
                // Esconder o export canvas novamente
                exportCanvas.style.position = 'absolute';
                exportCanvas.style.left = '-9999px';
                exportCanvas.style.top = '-9999px';
                exportCanvas.style.zIndex = 'auto';
                
                // Download da imagem
                const link = document.createElement('a');
                link.download = 'instagram-post-travel-frontiers.png';
                link.href = canvas2.toDataURL('image/png', 1.0);
                link.click();
                
                // Restaurar botão
                exportBtn.textContent = '💾 Exportar Imagem (1080×1350)';
                exportBtn.disabled = false;
            }).catch(function(error) {
                console.error('Erro ao exportar:', error);
                exportBtn.textContent = '❌ Erro - Tentar novamente';
                exportBtn.disabled = false;
                
                // Esconder o export canvas em caso de erro
                exportCanvas.style.position = 'absolute';
                exportCanvas.style.left = '-9999px';
                exportCanvas.style.top = '-9999px';
            });
        });
    }
    
    console.log('✅ Gerador Instagram Travel Frontiers carregado com sucesso!');
});
