// Promotion Generator App JS - Versão Final

document.addEventListener("DOMContentLoaded", function () {
    // Configurações iniciais e estado
    const preview = document.getElementById("promotion-preview");

    // Fontes
    const fontSelect = document.getElementById("font_family");

    // Imagens e logo
    const bgInput = document.getElementById("background_image");
    const logoInput = document.getElementById("logo_image");
    const logoSizeInput = document.getElementById("logo_size");
    let bgUrl = "";
    let logoUrl = "";
    let logoSize = 120;

    // Sliders de tamanho
    function updateSlider(id, cssVar, unit) {
        const inp = document.getElementById(id);
        if (!inp) return;
        inp.addEventListener("input", () => {
            document.documentElement.style.setProperty(cssVar, inp.value + unit);
            document.getElementById(id + "-value").textContent = inp.value + unit;
        });
        // Sync inicial
        document.documentElement.style.setProperty(cssVar, inp.value + unit);
        document.getElementById(id + "-value").textContent = inp.value + unit;
    }
    updateSlider("promo_tag_size","--promo-tag-font-size","rem");
    updateSlider("destination_size","--destination-font-size","rem");
    updateSlider("description_size","--description-font-size","rem");
    updateSlider("flight_services_size","--flight-services-font-size","rem");
    updateSlider("hotel_size","--hotel-font-size","rem");
    updateSlider("price_size","--price-font-size","rem");

    // Selectores de cor
    function updateColor(id, cssVar) {
        const inp = document.getElementById(id);
        if (!inp) return;
        inp.addEventListener("input", () => {
            document.documentElement.style.setProperty(cssVar, inp.value);
        });
        document.documentElement.style.setProperty(cssVar, inp.value);
    }
    updateColor("promo_tag_color","--promo-tag-text-color");
    updateColor("destination_color","--destination-text-color");
    updateColor("description_color","--description-text-color");
    updateColor("info_box_color","--info-box-text-color");

    // Transparências (sliders) + toggle display
    function updateAlpha(id, cssVar, targetId=null) {
        const inp = document.getElementById(id);
        if (!inp) return;
        inp.addEventListener("input", () => {
            const val = inp.value;
            document.documentElement.style.setProperty(cssVar, val/100);
            document.getElementById(id+"-value").textContent = val+"%";
            if(targetId) {
                const el = document.getElementById(targetId);
                if(el) el.style.display = (val=="0" ? "none" : "");
            }
        });
        document.documentElement.style.setProperty(cssVar, inp.value/100);
        document.getElementById(id+"-value").textContent = inp.value+"%";
        if(targetId) {
            const el = document.getElementById(targetId);
            if(el) el.style.display = (inp.value=="0" ? "none" : "");
        }
    }
    updateAlpha("info_box_transparency","--info-box-alpha","info-box-element");
    updateAlpha("destination_transparency","--destination-alpha","destination-element");
    updateAlpha("description_bg_transparency","--description-bg-alpha","description-box");
    updateAlpha("promo_tag_transparency","--promo-tag-alpha","promo-tag-element");

    // Font family
    fontSelect.addEventListener("change", () => {
        preview.style.fontFamily = fontSelect.value;
    });
    preview.style.fontFamily = fontSelect.value;

    // Upload imagem de fundo
    bgInput.addEventListener("change", function (e) {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = function (event) {
                bgUrl = event.target.result;
                preview.style.backgroundImage = `url(${bgUrl})`;
                document.getElementById("background-preview").style.backgroundImage = `url(${bgUrl})`;
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    // Upload logo
    logoInput.addEventListener("change", function (e) {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = function (event) {
                logoUrl = event.target.result;
                const logoDOM = preview.querySelector(".company-logo");
                if(logoDOM) logoDOM.src = logoUrl;
                document.getElementById("logo-preview").style.backgroundImage = `url(${logoUrl})`;
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    // Tamanho logo
    logoSizeInput.addEventListener("input", function() {
        logoSize = logoSizeInput.value;
        document.getElementById("logo-size-value").textContent = logoSize + "px";
        const logoDOM = preview.querySelector(".company-logo");
        if(logoDOM) logoDOM.style.width = logoSize + "px";
    });

    // Field mapping para preview
    const fieldMappings = {
        'promotional_tag': 'promo-tag-element',
        'destination': 'destination-element',
        'description': 'description-text',
        'flight_info': 'flight-info',
        'services': 'services-info',
        'hotel_name': 'hotel-info',
        'price': 'preview-price',
        'price_note': 'preview-note'
    };
    Object.entries(fieldMappings).forEach(([inputId, previewId]) => {
        const input = document.getElementById(inputId);
        if (!input) return;
        input.addEventListener("input", function () {
            const span = document.getElementById(previewId);
            if(span) span.innerHTML = input.value;
        });
        const span = document.getElementById(previewId);
        if(span) span.innerHTML = input.value;
    });

    // Inicialização do preview com defaults (caso existam)
    preview.style.backgroundImage = '';
    preview.style.fontFamily = fontSelect.value;
    document.getElementById("logo-size-value").textContent = logoSize + "px";

    // Preview acompanha scroll (não sticky)
    // Não é necessário código extra porque é layout normal

    // Inicialização dos displays dos sliders
    [
        "promo_tag_size", "destination_size", "description_size",
        "flight_services_size", "hotel_size", "price_size"
    ].forEach(id => {
        const inp = document.getElementById(id);
        const span = document.getElementById(id + "-value");
        if(inp && span) span.textContent = inp.value + "rem";
    });

    // Exemplo: balão promocional com cor dourada #CA9524
    document.documentElement.style.setProperty('--promo-tag-bg-color', '202, 149, 36');
    document.getElementById("promo-tag-element").style.background = "rgba(202, 149, 36, var(--promo-tag-alpha))";
});

// Fim do JS integral
