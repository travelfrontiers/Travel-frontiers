document.addEventListener("DOMContentLoaded", function () {

    function safeSet(id, val, suffix) {
        const el = document.getElementById(id);
        if (el) el.textContent = val + (suffix||"");
    }
    function safeDisplay(id, show) {
        const el = document.getElementById(id);
        if (el) el.style.display = show ? "" : "none";
    }

    // Tamanhos de fonte sliders
    [
        ["promo_tag_size","--promo-tag-font-size","rem"],
        ["destination_size","--destination-font-size","rem"],
        ["description_size","--description-font-size","rem"]
    ].forEach(([inputId, cssVar, unit])=>{
        const inp=document.getElementById(inputId);
        safeSet(inputId+"-value",inp.value,unit);
        document.documentElement.style.setProperty(cssVar,inp.value+unit);
        inp.addEventListener("input",function(){
            safeSet(inputId+"-value",inp.value,unit);
            document.documentElement.style.setProperty(cssVar,inp.value+unit);
        });
    });

    // Color pickers
    [
        ["promo_tag_color","--promo-tag-text-color"],
        ["destination_color","--destination-text-color"],
        ["description_color","--description-text-color"]
    ].forEach(([inputId,cssVar])=>{
        const inp=document.getElementById(inputId);
        document.documentElement.style.setProperty(cssVar, inp.value);
        inp.addEventListener("input",function(){
            document.documentElement.style.setProperty(cssVar,inp.value);
        });
    });

    // Tamanho logo
    const logoInput = document.getElementById("logo_size");
    safeSet("logo_size-value",logoInput.value,"px");
    logoInput.addEventListener("input",function(){
        safeSet("logo_size-value",logoInput.value,"px");
        document.getElementById("company-logo").style.width = logoInput.value + "px";
    });

    // Transparência caixa detalhes (info)
    const detailsBoxTransparency = document.getElementById("details_box_transparency");
    safeSet("details_box_transparency-value",detailsBoxTransparency.value,"%");
    document.documentElement.style.setProperty("--details-box-bg-alpha", detailsBoxTransparency.value/100);
    detailsBoxTransparency.addEventListener("input",function(){
        safeSet("details_box_transparency-value",detailsBoxTransparency.value,"%");
        document.documentElement.style.setProperty("--details-box-bg-alpha", detailsBoxTransparency.value/100);
        // Oculta caixa se transparência zero
        safeDisplay("details-box", detailsBoxTransparency.value != "0");
    });

    // Upload imagem fundo
    document.getElementById("background_image").addEventListener("change",function(e){
        if(e.target.files && e.target.files[0]){
            const reader=new FileReader();
            reader.onload=function(ev){
                document.getElementById("promotion-preview").style.backgroundImage = `url(${ev.target.result})`;
                document.getElementById("background-preview").style.backgroundImage = `url(${ev.target.result})`;
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    // Upload logo
    document.getElementById("logo_image").addEventListener("change",function(e){
        if(e.target.files && e.target.files[0]){
            const reader=new FileReader();
            reader.onload=function(ev){
                document.getElementById("company-logo").src = ev.target.result;
                document.getElementById("logo-preview").style.backgroundImage = `url(${ev.target.result})`;
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    // Mapping campos para preview
    const mapping = {
        "promotional_tag": "promo-tag-element",
        "destination": "destination-element",
        "description": "description-element",
        "flight_info": "flight-info",
        "services": "services-info",
        "hotel_name": "hotel-info",
        "price": "preview-price",
        "price_note": "preview-note"
    };
    Object.entries(mapping).forEach(([inputId, previewId])=>{
        const inp=document.getElementById(inputId);
        const prev=document.getElementById(previewId);
        if(inp && prev){
            prev.innerHTML = inp.value;
            inp.addEventListener("input",function(){ prev.innerHTML = inp.value; });
        }
    });
});
