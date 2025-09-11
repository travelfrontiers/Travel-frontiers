document.addEventListener("DOMContentLoaded", function () {
    // Função segura para atualização e proteção contra erro de elementos inexistentes
    function safeSet(id, val, suffix) {
        const el = document.getElementById(id);
        if (el) el.textContent = val + (suffix||"");
    }
    function safeDisplay(id, show) {
        const el = document.getElementById(id);
        if (el) el.style.display = show ? "" : "none";
    }

    // Sliders de tamanho
    [
        ["promo_tag_size","--promo-tag-font-size",'rem'],
        ["destination_size","--destination-font-size",'rem'],
        ["description_size","--description-font-size",'rem'],
        ["flight_services_size","--flight-services-font-size",'rem'],
        ["hotel_size","--hotel-font-size",'rem'],
        ["price_size","--price-font-size",'rem']
    ].forEach(arr => {
        const inp = document.getElementById(arr[0]);
        safeSet(arr[0]+"-value", inp.value, arr[2]);
        document.documentElement.style.setProperty(arr[1], inp.value + arr[2]);
        inp.addEventListener("input", function() {
            safeSet(arr[0]+"-value", inp.value, arr[2]);
            document.documentElement.style.setProperty(arr[1], inp.value + arr[2]);
        });
    });

    // Color pickers
    [
        ["promo_tag_color","--promo-tag-text-color"],
        ["destination_color","--destination-text-color"],
        ["description_color","--description-text-color"]
    ].forEach(arr => {
        const inp = document.getElementById(arr[0]);
        document.documentElement.style.setProperty(arr[1], inp.value);
        inp.addEventListener("input", function() {
            document.documentElement.style.setProperty(arr[1], inp.value);
        });
    });

    // Transparências
    [
        ["promo_tag_transparency",'--promo-tag-alpha','promo-tag-element'],
        ["destination_transparency",'--destination-alpha','destination-element'],
        ["description_bg_transparency",'--description-bg-alpha','description-box']
    ].forEach(arr=>{
        const inp=document.getElementById(arr[0]);
        safeSet(arr[0]+"-value", inp.value, "%");
        document.documentElement.style.setProperty(arr[1], inp.value/100);
        safeDisplay(arr[2], inp.value!="0");
        inp.addEventListener("input", function() {
            safeSet(arr[0]+"-value", inp.value, "%");
            document.documentElement.style.setProperty(arr[1], inp.value/100);
            safeDisplay(arr[2], inp.value!="0");
        });
    });

    // Logo tamanho
    const logoInput = document.getElementById("logo_size");
    safeSet("logo_size-value", logoInput.value, "px");
    logoInput.addEventListener("input", function() {
        safeSet("logo_size-value", logoInput.value, "px");
        document.getElementById("company-logo").style.width = logoInput.value+"px";
    });

    // Background upload
    document.getElementById("background_image").addEventListener("change", function(e){
        if(e.target.files&&e.target.files[0]){
            const reader=new FileReader();
            reader.onload=function(ev){
                document.getElementById("promotion-preview").style.backgroundImage=`url(${ev.target.result})`;
                document.getElementById("background-preview").style.backgroundImage=`url(${ev.target.result})`;
            }; reader.readAsDataURL(e.target.files[0]);
        }
    });
    // Logo upload
    document.getElementById("logo_image").addEventListener("change", function(e){
        if(e.target.files&&e.target.files[0]){
            const reader=new FileReader();
            reader.onload=function(ev){
                document.getElementById("company-logo").src=ev.target.result;
                document.getElementById("logo-preview").style.backgroundImage=`url(${ev.target.result})`;
            }; reader.readAsDataURL(e.target.files[0]);
        }
    });

    // Mapping de campos para preview
    const mapping = {
        "promotional_tag":"promo-tag-element",
        "destination":"destination-element",
        "description":"description-text",
        "flight_info":"flight-info",
        "services":"services-info",
        "hotel_name":"hotel-info",
        "price":"preview-price",
        "price_note":"preview-note"
    };
    Object.entries(mapping).forEach(([input, preview]) => {
        const inp = document.getElementById(input);
        const prev = document.getElementById(preview);
        if(inp && prev) {
            prev.innerHTML = inp.value;
            inp.addEventListener("input", function(){ prev.innerHTML = inp.value; });
        }
    });
});
