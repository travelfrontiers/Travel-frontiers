document.addEventListener("DOMContentLoaded", function () {

function safeSet(id, val, suffix){ const el=document.getElementById(id); if(el) el.textContent=val+(suffix||""); }
function safeDisplay(id, show){ const el=document.getElementById(id); if(el) el.style.display= show? "":"none"; }

// Sliders de tamanhos (mantidos)
[["promo_tag_size","--promo-tag-font-size","rem"],
["destination_size","--destination-font-size","rem"],
["description_size","--description-font-size","rem"]
].forEach(([inputId,cssVar,unit])=>{
const inp=document.getElementById(inputId);
if(!inp) return;
safeSet(inputId+"-value",inp.value,unit);
document.documentElement.style.setProperty(cssVar,inp.value+unit);
inp.addEventListener("input",()=>{ safeSet(inputId+"-value",inp.value,unit); document.documentElement.style.setProperty(cssVar,inp.value+unit); });
});

// Cores (mantidos)
[["promo_tag_color","--promo-tag-text-color"],
["destination_color","--destination-text-color"],
["description_color","--description-text-color"]
].forEach(([inputId,cssVar])=>{
const inp=document.getElementById(inputId);
if(!inp) return;
document.documentElement.style.setProperty(cssVar, inp.value);
inp.addEventListener("input",()=> document.documentElement.style.setProperty(cssVar, inp.value));
});

// Logo
const logoSize=document.getElementById("logo_size");
if(logoSize){
safeSet("logo_size-value",logoSize.value,"px");
logoSize.addEventListener("input",()=>{
safeSet("logo_size-value",logoSize.value,"px");
const img=document.getElementById("company-logo");
if(img) img.style.width=logoSize.value+"px";
});
}

// NOVO: transparência da caixa da descrição
const descBg = document.getElementById("description_bg_transparency");
if(descBg){
const apply = ()=> {
safeSet("description_bg_transparency-value", descBg.value, "%");
document.documentElement.style.setProperty("--description-bg-alpha", descBg.value/100);
safeDisplay("description-box", descBg.value !== "0");
};
apply();
descBg.addEventListener("input", apply);
}

// Uploads
const bgInput=document.getElementById("background_image");
if(bgInput){
bgInput.addEventListener("change",e=>{
if(e.target.files && e.target.files){
const r=new FileReader();
r.onload=ev=>{
document.getElementById("promotion-preview").style.backgroundImage=url(${ev.target.result});
document.getElementById("background-preview").style.backgroundImage=url(${ev.target.result});
};
r.readAsDataURL(e.target.files);
}
});
}
const logoInput=document.getElementById("logo_image");
if(logoInput){
logoInput.addEventListener("change",e=>{
if(e.target.files && e.target.files){
const r=new FileReader();
r.onload=ev=>{
document.getElementById("company-logo").src=ev.target.result;
document.getElementById("logo-preview").style.backgroundImage=url(${ev.target.result});
};
r.readAsDataURL(e.target.files);
}
});
}

// Mapping de texto -> preview (mantido)
const mapping={
promotional_tag:"promo-tag-element",
destination:"destination-element",
description:"description-element",
flight_info:"flight-info",
services:"services-info",
hotel_name:"hotel-info",
price:"preview-price",
price_note:"preview-note"
};
Object.entries(mapping).forEach(([inputId,previewId])=>{
const inp=document.getElementById(inputId);
const prev=document.getElementById(previewId);
if(inp && prev){
prev.innerHTML=inp.value;
inp.addEventListener("input",()=> prev.innerHTML=inp.value);
}
});
});
