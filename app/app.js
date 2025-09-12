            
}
)
;
            
// Aplicar transparência inicial
            
const
 
alpha
 = 
input
.
value
 / 
100
;
            
updateValue
(
control
.
valueElement
, 
input
.
value
, 
'%'
)
;
            
control
.
target
.
style
.
opacity
 = 
alpha
;
        
}
    
}
)
;
    
    
// NOVO: Função de Export Corrigida - Captura o canvas sem scale
    
const
 
exportBtn
 = 
document
.
getElementById
(
'export_btn'
)
;
    
if
 
(
exportBtn
)
 
{
        
exportBtn
.
addEventListener
(
'click'
, 
function
(
)
 
{
            
exportBtn
.
textContent
 = 
'⏳ Gerando imagem...'
;
            
exportBtn
.
disabled
 = 
true
;
            
            
// Remover temporariamente o scale para captura
            
const
 
originalTransform
 = 
canvas
.
style
.
transform
;
            
canvas
.
style
.
transform
 = 
'scale(1)'
;
            
            
// Remover temporariamente box-shadow da .controls-panel
            
const
 
controlsPanel
 = 
document
.
querySelector
(
'.controls-panel'
)
;
            
const
 
originalBoxShadow
 = 
controlsPanel
 ? 
controlsPanel
.
style
.
boxShadow
 : 
null
;
            
if
 
(
controlsPanel
)
 
{
                
controlsPanel
.
style
.
boxShadow
 = 
'none'
;
            
}
            
            
// Aguardar um momento para o CSS aplicar
            
setTimeout
(
(
)
 => 
{
                
html2canvas
(
canvas
, 
{
                    
width
: 
1080
,
                    
height
: 
1350
,
                    
scale
: 
2
,
                    
useCORS
: 
true
,
                    
backgroundColor
: 
'#fff'
,
                    
allowTaint
: 
true
                
}
)
.
then
(
function
(
capturedCanvas
)
 
{
                    
// Restaurar o transform original
                    
canvas
.
style
.
transform
 = 
originalTransform
;
                    
                    
// Restaurar box-shadow original
                    
if
 
(
controlsPanel
 && 
originalBoxShadow
 !== 
null
)
 
{
                        
controlsPanel
.
style
.
boxShadow
 = 
originalBoxShadow
;
                    
}
                    
                    
// Download da imagem
                    
const
 
link
 = 
document
.
createElement
(
'a'
)
;
                    
link
.
download
 = 
'instagram-post-travel-frontiers.png'
;
                    
link
.
href
 = 
capturedCanvas
.
toDataURL
(
'image/png'
, 
1.0
)
;
                    
link
.
click
(
)
;
                    
                    
// Restaurar botão
                    
exportBtn
.
textContent
 = 
'💾 Exportar Imagem (1080×1350)'
;
                    
exportBtn
.
disabled
 = 
false
;
                
}
)
.
catch
(
function
(
error
)
 
{
                    
console
.
error
(
'Erro ao exportar:'
, 
error
)
;
                    
canvas
.
style
.
transform
 = 
originalTransform
;
                    
                    
// Restaurar box-shadow original em caso de erro
                    
if
 
(
controlsPanel
 && 
originalBoxShadow
 !== 
null
)
 
{
                        
controlsPanel
.
style
.
boxShadow
 = 
originalBoxShadow
;
                    
}
                    
                    
exportBtn
.
textContent
 = 
'❌ Erro - Tentar novamente'
;
                    
exportBtn
.
disabled
 = 
false
;
                
}
)
;
            
}
, 
100
)
;
        
}
)
;
    
}
    
    
console
.
log
(
'✅ Gerador Instagram carregado!'
)
;
}
)
;
