class PromotionGenerator {
    constructor() {
        this.form = document.getElementById('promotion-form');
        this.preview = document.getElementById('promotion-preview');
        this.resetBtn = document.getElementById('reset-btn');
        this.exportBtn = document.getElementById('export-btn');
        
        // Image elements
        this.backgroundInput = document.getElementById('background_image');
        this.logoInput = document.getElementById('logo_image');
        this.backgroundPreview = document.getElementById('background-preview');
        this.logoPreview = document.getElementById('logo-preview');
        this.companyLogoImg = document.getElementById('company-logo-img');
        this.logoPlaceholder = document.getElementById('company-logo-placeholder');
        
        // Transparency controls
        this.promoTagAlpha = document.getElementById('promo_tag_alpha');
        this.destinationAlpha = document.getElementById('destination_alpha');
        this.descriptionAlpha = document.getElementById('description_alpha');
        this.infoBoxAlpha = document.getElementById('info_box_alpha');
        this.logoSize = document.getElementById('logo_size');
        
        // Color controls
        this.promotionalTagColor = document.getElementById('promotional_tag_color');
        this.destinationColor = document.getElementById('destination_color');
        this.descriptionColor = document.getElementById('description_color');
        this.infoBoxColor = document.getElementById('info_box_color');
        
        this.fieldMappings = {
            'promotional_tag': 'preview-tag',
            'destination': 'preview-destination',
            'description': 'preview-description',
            'flight_info': 'preview-flight',
            'services': 'preview-services',
            'location': 'preview-location',
            'price': 'preview-price',
            'price_note': 'preview-note' // Fixed field mapping
        };
        
        this.currentBackgroundImage = null;
        this.currentLogoImage = null;
        
        this.init();
    }
    
    init() {
        this.attachEventListeners();
        this.updateSliderValues(); // Initialize slider value displays
        this.updateLogoDisplay(); // Initialize logo display
        this.updateTextColors(); // Initialize text colors
        this.updatePreview(); // Initial preview update
    }
    
    attachEventListeners() {
        // Real-time preview updates for text fields
        Object.keys(this.fieldMappings).forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', () => this.updatePreview());
                field.addEventListener('change', () => this.updatePreview());
            }
        });
        
        // Color control listeners
        if (this.promotionalTagColor) {
            this.promotionalTagColor.addEventListener('input', () => this.updateTextColors());
        }
        if (this.destinationColor) {
            this.destinationColor.addEventListener('input', () => this.updateTextColors());
        }
        if (this.descriptionColor) {
            this.descriptionColor.addEventListener('input', () => this.updateTextColors());
        }
        if (this.infoBoxColor) {
            this.infoBoxColor.addEventListener('input', () => this.updateTextColors());
        }
        
        // Transparency control sliders
        if (this.promoTagAlpha) {
            this.promoTagAlpha.addEventListener('input', () => this.updateTransparency());
        }
        if (this.destinationAlpha) {
            this.destinationAlpha.addEventListener('input', () => this.updateTransparency());
        }
        if (this.descriptionAlpha) {
            this.descriptionAlpha.addEventListener('input', () => this.updateTransparency());
        }
        if (this.infoBoxAlpha) {
            this.infoBoxAlpha.addEventListener('input', () => this.updateTransparency());
        }
        
        // Logo size slider
        if (this.logoSize) {
            this.logoSize.addEventListener('input', () => this.updateLogoSize());
        }
        
        // Image upload handlers
        if (this.backgroundInput) {
            this.backgroundInput.addEventListener('change', (e) => this.handleBackgroundUpload(e));
        }
        
        if (this.logoInput) {
            this.logoInput.addEventListener('change', (e) => this.handleLogoUpload(e));
        }
        
        // Reset button
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.resetForm();
            });
        }
        
        // Export button
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportPromotion();
            });
        }
    }
    
    updateTextColors() {
        // Update CSS custom properties for text colors
        if (this.promotionalTagColor) {
            document.documentElement.style.setProperty('--promotional-tag-color', this.promotionalTagColor.value);
        }
        if (this.destinationColor) {
            document.documentElement.style.setProperty('--destination-color', this.destinationColor.value);
        }
        if (this.descriptionColor) {
            document.documentElement.style.setProperty('--description-color', this.descriptionColor.value);
        }
        if (this.infoBoxColor) {
            document.documentElement.style.setProperty('--info-box-color', this.infoBoxColor.value);
        }
        
        // Add updating animation
        this.preview.classList.add('updating');
        setTimeout(() => {
            this.preview.classList.remove('updating');
        }, 300);
    }
    
    updateTransparency() {
        // Update CSS custom properties for transparency
        const promoTagValue = this.promoTagAlpha.value / 100;
        const destinationValue = this.destinationAlpha.value / 100;
        const descriptionValue = this.descriptionAlpha.value / 100;
        const infoBoxValue = this.infoBoxAlpha.value / 100;
        
        document.documentElement.style.setProperty('--promo-tag-alpha', promoTagValue);
        document.documentElement.style.setProperty('--destination-alpha', destinationValue);
        document.documentElement.style.setProperty('--description-alpha', descriptionValue);
        document.documentElement.style.setProperty('--info-box-alpha', infoBoxValue);
        
        // Handle 0% transparency = display: none
        const bannerTag = document.getElementById('banner-tag');
        const destinationSection = document.querySelector('.destination-section');
        const infoBox = document.getElementById('info-box');
        
        if (bannerTag) {
            bannerTag.style.display = promoTagValue === 0 ? 'none' : 'block';
        }
        if (destinationSection) {
            destinationSection.style.display = destinationValue === 0 ? 'none' : 'block';
        }
        if (infoBox) {
            infoBox.style.display = infoBoxValue === 0 ? 'none' : 'grid';
        }
        
        // Update slider value displays
        this.updateSliderValues();
        
        // Add updating animation
        this.preview.classList.add('updating');
        setTimeout(() => {
            this.preview.classList.remove('updating');
        }, 300);
    }
    
    updateLogoSize() {
        const sizeValue = this.logoSize.value + 'px';
        document.documentElement.style.setProperty('--logo-size', sizeValue);
        
        // Update slider value display
        const logoSizeValue = document.getElementById('logo-size-value');
        if (logoSizeValue) {
            logoSizeValue.textContent = sizeValue;
        }
        
        // Add updating animation
        this.preview.classList.add('updating');
        setTimeout(() => {
            this.preview.classList.remove('updating');
        }, 300);
    }
    
    updateSliderValues() {
        // Update all slider value displays
        const sliders = [
            { slider: this.promoTagAlpha, display: 'promo-tag-alpha-value' },
            { slider: this.destinationAlpha, display: 'destination-alpha-value' },
            { slider: this.descriptionAlpha, display: 'description-alpha-value' },
            { slider: this.infoBoxAlpha, display: 'info-box-alpha-value' }
        ];
        
        sliders.forEach(({ slider, display }) => {
            if (slider) {
                const displayElement = document.getElementById(display);
                if (displayElement) {
                    displayElement.textContent = slider.value + '%';
                }
            }
        });
        
        // Update logo size display
        if (this.logoSize) {
            const logoSizeValue = document.getElementById('logo-size-value');
            if (logoSizeValue) {
                logoSizeValue.textContent = this.logoSize.value + 'px';
            }
        }
    }
    
    updateLogoDisplay() {
        if (this.currentLogoImage && this.companyLogoImg && this.logoPlaceholder) {
            // Show actual logo, hide placeholder
            this.companyLogoImg.src = this.currentLogoImage;
            this.companyLogoImg.style.display = 'block';
            this.logoPlaceholder.style.display = 'none';
        } else if (this.logoPlaceholder && this.companyLogoImg) {
            // Show placeholder, hide logo
            this.companyLogoImg.style.display = 'none';
            this.logoPlaceholder.style.display = 'flex';
        }
    }
    
    handleBackgroundUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                this.showMessage('A imagem é muito grande. Escolha uma imagem menor que 10MB.', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                this.currentBackgroundImage = e.target.result;
                this.updateBackgroundPreview();
                this.updatePromotionBackground();
                this.showMessage('Imagem de fundo carregada com sucesso!', 'success');
            };
            reader.onerror = () => {
                this.showMessage('Erro ao carregar a imagem de fundo.', 'error');
            };
            reader.readAsDataURL(file);
        } else if (file) {
            this.showMessage('Por favor, selecione um arquivo de imagem válido.', 'error');
        }
    }
    
    handleLogoUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                this.showMessage('O logo é muito grande. Escolha uma imagem menor que 5MB.', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                this.currentLogoImage = e.target.result;
                this.updateLogoPreview();
                this.updateLogoDisplay();
                this.showMessage('Logo carregado com sucesso!', 'success');
            };
            reader.onerror = () => {
                this.showMessage('Erro ao carregar o logo.', 'error');
            };
            reader.readAsDataURL(file);
        } else if (file) {
            this.showMessage('Por favor, selecione um arquivo de imagem válido.', 'error');
        }
    }
    
    updateBackgroundPreview() {
        if (this.currentBackgroundImage && this.backgroundPreview) {
            this.backgroundPreview.innerHTML = `
                <img src="${this.currentBackgroundImage}" alt="Background preview">
                <button type="button" class="remove-image" onclick="promotionGenerator.removeBackgroundImage()" title="Remover imagem">×</button>
            `;
            this.backgroundPreview.classList.add('has-image');
        } else {
            this.backgroundPreview.innerHTML = '';
            this.backgroundPreview.classList.remove('has-image');
        }
    }
    
    updateLogoPreview() {
        if (this.currentLogoImage && this.logoPreview) {
            this.logoPreview.innerHTML = `
                <img src="${this.currentLogoImage}" alt="Logo preview">
                <button type="button" class="remove-image" onclick="promotionGenerator.removeLogoImage()" title="Remover logo">×</button>
            `;
            this.logoPreview.classList.add('has-image');
        } else {
            this.logoPreview.innerHTML = '';
            this.logoPreview.classList.remove('has-image');
        }
    }
    
    updatePromotionBackground() {
        if (this.currentBackgroundImage && this.preview) {
            this.preview.style.backgroundImage = `url(${this.currentBackgroundImage})`;
            this.preview.style.backgroundSize = 'cover';
            this.preview.style.backgroundPosition = 'center';
            this.preview.style.backgroundRepeat = 'no-repeat';
        } else {
            // Reset to default gradient background
            this.preview.style.backgroundImage = '';
        }
    }
    
    removeBackgroundImage() {
        this.currentBackgroundImage = null;
        this.backgroundInput.value = '';
        this.updateBackgroundPreview();
        this.updatePromotionBackground();
        this.showMessage('Imagem de fundo removida.', 'info');
    }
    
    removeLogoImage() {
        this.currentLogoImage = null;
        this.logoInput.value = '';
        this.updateLogoPreview();
        this.updateLogoDisplay(); // This will show the placeholder again
        this.showMessage('Logo removido.', 'info');
    }
    
    updatePreview() {
        // Add updating animation class
        this.preview.classList.add('updating');
        
        Object.entries(this.fieldMappings).forEach(([fieldId, previewId]) => {
            const field = document.getElementById(fieldId);
            const previewElement = document.getElementById(previewId);
            
            if (field && previewElement) {
                const value = field.value.trim();
                
                if (value) {
                    // Fixed: Use exact field value without any modification
                    previewElement.textContent = value;
                    previewElement.classList.remove('empty-field');
                } else {
                    // Handle empty fields with placeholder text
                    const placeholderText = this.getPlaceholderText(fieldId);
                    previewElement.textContent = placeholderText;
                    previewElement.classList.add('empty-field');
                }
            }
        });
        
        // Remove animation class after animation completes
        setTimeout(() => {
            this.preview.classList.remove('updating');
        }, 300);
        
        // Validate form
        this.validateForm();
    }
    
    getPlaceholderText(fieldId) {
        const placeholders = {
            'promotional_tag': 'ETIQUETA PROMOCIONAL',
            'destination': 'DESTINO',
            'description': 'Descrição da viagem aparecerá aqui...',
            'flight_info': 'INFORMAÇÕES DE VOO',
            'services': 'SERVIÇOS INCLUÍDOS',
            'location': 'Hotel/Localização',
            'price': '€€€',
            'price_note': ''
        };
        
        return placeholders[fieldId] || '';
    }
    
    validateForm() {
        const requiredFields = ['promotional_tag', 'destination', 'description', 'price'];
        const isValid = requiredFields.every(fieldId => {
            const field = document.getElementById(fieldId);
            return field && field.value.trim().length > 0;
        });
        
        // Update export button state
        if (this.exportBtn) {
            this.exportBtn.disabled = !isValid;
        }
        
        return isValid;
    }
    
    resetForm() {
        try {
            // Clear all form fields
            Object.keys(this.fieldMappings).forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.value = '';
                }
            });
            
            // Reset transparency sliders to defaults
            if (this.promoTagAlpha) this.promoTagAlpha.value = 100;
            if (this.destinationAlpha) this.destinationAlpha.value = 100;
            if (this.descriptionAlpha) this.descriptionAlpha.value = 100;
            if (this.infoBoxAlpha) this.infoBoxAlpha.value = 85;
            if (this.logoSize) this.logoSize.value = 32;
            
            // Reset color controls to defaults
            if (this.promotionalTagColor) this.promotionalTagColor.value = '#FFFFFF';
            if (this.destinationColor) this.destinationColor.value = '#2C3E50';
            if (this.descriptionColor) this.descriptionColor.value = '#34495E';
            if (this.infoBoxColor) this.infoBoxColor.value = '#2C3E50';
            
            // Clear images
            this.removeBackgroundImage();
            this.removeLogoImage();
            
            // Reset transparency values and colors
            this.updateTransparency();
            this.updateLogoSize();
            this.updateTextColors();
            
            // Update preview immediately
            this.updatePreview();
            
            // Show success message
            this.showMessage('Formulário limpo com sucesso!', 'success');
            
        } catch (error) {
            console.error('Error resetting form:', error);
            this.showMessage('Erro ao limpar o formulário.', 'error');
        }
    }
    
    exportPromotion() {
        try {
            if (!this.validateForm()) {
                this.showMessage('Por favor, preencha todos os campos obrigatórios.', 'error');
                return;
            }
            
            // Get current form data including images and transparency settings
            const formData = this.getFormData();
            
            // Create a downloadable data structure
            const exportData = {
                content: formData,
                transparency: {
                    promo_tag: this.promoTagAlpha.value,
                    destination: this.destinationAlpha.value,
                    description: this.descriptionAlpha.value,
                    info_box: this.infoBoxAlpha.value
                },
                colors: {
                    promotional_tag: this.promotionalTagColor.value,
                    destination: this.destinationColor.value,
                    description: this.descriptionColor.value,
                    info_box: this.infoBoxColor.value
                },
                logo_size: this.logoSize.value,
                created_at: new Date().toISOString(),
                version: '2.1'
            };
            
            // Create download link
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            // Create download link
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `promocao_${formData.destination.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.json`;
            downloadLink.style.display = 'none';
            
            // Trigger download
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // Clean up
            URL.revokeObjectURL(url);
            
            // Show success message
            this.showMessage('Promoção exportada com sucesso! O arquivo foi baixado.', 'success');
            
            // Log for debugging
            console.log('Exported promotion data:', exportData);
            
        } catch (error) {
            console.error('Error exporting promotion:', error);
            this.showMessage('Erro ao exportar a promoção.', 'error');
        }
    }
    
    getFormData() {
        const data = {};
        Object.keys(this.fieldMappings).forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                data[fieldId] = field.value.trim();
            }
        });
        
        // Include image data
        data.background_image = this.currentBackgroundImage;
        data.logo_image = this.currentLogoImage;
        data.has_background = !!this.currentBackgroundImage;
        data.has_logo = !!this.currentLogoImage;
        
        return data;
    }
    
    showMessage(message, type = 'info') {
        try {
            // Remove any existing message
            const existingMessage = document.querySelector('.app-message');
            if (existingMessage) {
                existingMessage.remove();
            }
            
            // Create message element
            const messageEl = document.createElement('div');
            messageEl.className = `app-message status status--${type}`;
            messageEl.textContent = message;
            
            // Style the message
            Object.assign(messageEl.style, {
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: '1000',
                maxWidth: '400px',
                boxShadow: 'var(--shadow-lg)',
                opacity: '0',
                transform: 'translateX(100%)',
                transition: 'all 0.3s ease-out'
            });
            
            // Add to page
            document.body.appendChild(messageEl);
            
            // Animate in
            setTimeout(() => {
                messageEl.style.opacity = '1';
                messageEl.style.transform = 'translateX(0)';
            }, 50);
            
            // Auto remove after 4 seconds
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.style.opacity = '0';
                    messageEl.style.transform = 'translateX(100%)';
                    
                    setTimeout(() => {
                        if (messageEl.parentNode) {
                            messageEl.remove();
                        }
                    }, 300);
                }
            }, 4000);
            
        } catch (error) {
            console.error('Error showing message:', error);
        }
    }
    
    // Method to load imported data
    loadImportedData(importData) {
        try {
            if (importData.content) {
                // Load form fields
                Object.entries(importData.content).forEach(([fieldId, value]) => {
                    if (fieldId.includes('_image') || fieldId.startsWith('has_')) return;
                    
                    const field = document.getElementById(fieldId);
                    if (field && value) {
                        field.value = value;
                    }
                });
            }
            
            // Load transparency settings
            if (importData.transparency) {
                if (this.promoTagAlpha && importData.transparency.promo_tag) {
                    this.promoTagAlpha.value = importData.transparency.promo_tag;
                }
                if (this.destinationAlpha && importData.transparency.destination) {
                    this.destinationAlpha.value = importData.transparency.destination;
                }
                if (this.descriptionAlpha && importData.transparency.description) {
                    this.descriptionAlpha.value = importData.transparency.description;
                }
                if (this.infoBoxAlpha && importData.transparency.info_box) {
                    this.infoBoxAlpha.value = importData.transparency.info_box;
                }
                
                this.updateTransparency();
            }
            
            // Load color settings
            if (importData.colors) {
                if (this.promotionalTagColor && importData.colors.promotional_tag) {
                    this.promotionalTagColor.value = importData.colors.promotional_tag;
                }
                if (this.destinationColor && importData.colors.destination) {
                    this.destinationColor.value = importData.colors.destination;
                }
                if (this.descriptionColor && importData.colors.description) {
                    this.descriptionColor.value = importData.colors.description;
                }
                if (this.infoBoxColor && importData.colors.info_box) {
                    this.infoBoxColor.value = importData.colors.info_box;
                }
                
                this.updateTextColors();
            }
            
            // Load logo size
            if (importData.logo_size && this.logoSize) {
                this.logoSize.value = importData.logo_size;
                this.updateLogoSize();
            }
            
            // Update preview
            this.updatePreview();
            this.showMessage('Dados importados com sucesso!', 'success');
            
        } catch (error) {
            console.error('Error loading imported data:', error);
            this.showMessage('Erro ao importar os dados.', 'error');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        const generator = new PromotionGenerator();
        
        // Make generator available globally for image removal
        window.promotionGenerator = generator;
        
        console.log('Promotion generator with transparency controls initialized successfully');
        
    } catch (error) {
        console.error('Error initializing application:', error);
    }
});

// Add drag and drop functionality
document.addEventListener('DOMContentLoaded', () => {
    const fileUploadLabels = document.querySelectorAll('.file-upload-label');
    
    fileUploadLabels.forEach(label => {
        const inputId = label.getAttribute('for');
        const input = document.getElementById(inputId);
        
        if (input) {
            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                label.addEventListener(eventName, preventDefaults, false);
                document.body.addEventListener(eventName, preventDefaults, false);
            });
            
            // Highlight drop area when item is dragged over it
            ['dragenter', 'dragover'].forEach(eventName => {
                label.addEventListener(eventName, () => {
                    label.style.background = 'var(--color-secondary-hover)';
                    label.style.borderColor = 'var(--color-primary)';
                }, false);
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
                label.addEventListener(eventName, () => {
                    label.style.background = 'var(--color-secondary)';
                    label.style.borderColor = 'var(--color-border)';
                }, false);
            });
            
            // Handle dropped files
            label.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                
                if (files.length > 0) {
                    // Create a new FileList-like object
                    const newFileList = new DataTransfer();
                    newFileList.items.add(files[0]);
                    input.files = newFileList.files;
                    
                    // Trigger change event
                    const changeEvent = new Event('change', { bubbles: true });
                    input.dispatchEvent(changeEvent);
                }
            }, false);
        }
    });
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}