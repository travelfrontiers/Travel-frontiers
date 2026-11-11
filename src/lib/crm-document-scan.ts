import {lisbonDay} from "./crm-calendar";
import {combineIdentityPages, readIdentityPage, type DocumentReading} from "./crm-document-ocr";
import type {Worker as OcrWorker} from "tesseract.js";

const assets="/ocr-assets";
export const identityFileLimit=15*1024*1024;
export const identityFileTypes=["image/jpeg","image/png","image/webp","application/pdf"];

function canvas(width:number,height:number) {
  const result=document.createElement("canvas");
  result.width=Math.max(1,Math.round(width));
  result.height=Math.max(1,Math.round(height));
  const context=result.getContext("2d",{alpha:false});
  if(!context) throw new Error("O navegador não conseguiu preparar a imagem.");
  context.fillStyle="#fff";
  context.fillRect(0,0,result.width,result.height);
  return {result,context};
}

async function imagePage(file:File) {
  const image=await createImageBitmap(file);
  try {
    const scale=Math.min(1,2400/Math.max(image.width,image.height));
    const {result,context}=canvas(image.width*scale,image.height*scale);
    context.drawImage(image,0,0,result.width,result.height);
    return result;
  } finally { image.close(); }
}

type ScanPage = { image: HTMLCanvasElement; text: string };

async function pdfPages(file:File,available:number) {
  const {getDocument,GlobalWorkerOptions}=await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc=assets+"/pdf/pdf.worker.min.mjs";
  const task=getDocument({
    data:new Uint8Array(await file.arrayBuffer()),enableXfa:false,
    wasmUrl:assets+"/pdf/wasm/",cMapUrl:assets+"/pdf/cmaps/",cMapPacked:true,
    standardFontDataUrl:assets+"/pdf/standard_fonts/",iccUrl:assets+"/pdf/iccs/",
  });
  try {
    const pdf=await task.promise;
    if(pdf.numPages>available) throw new Error("Seleciona até duas páginas ou faces do mesmo documento.");
    const pages:ScanPage[]=[];
    for(let number=1;number<=pdf.numPages;number++) {
      const page=await pdf.getPage(number);
      const size=page.getViewport({scale:1});
      const viewport=page.getViewport({scale:2400/Math.max(size.width,size.height)});
      const {result,context}=canvas(viewport.width,viewport.height);
      await page.render({canvas:result,canvasContext:context,viewport}).promise;
      const content = await page.getTextContent().catch(() => null);
      let lineY: number | undefined;
      const text = content?.items.map(item => {
        if (!("str" in item)) return "";
        const nextY = item.transform[5];
        const separator = lineY !== undefined && Math.abs(nextY - lineY) > 2 ? "\n" : "";
        lineY = item.hasEOL ? undefined : nextY;
        return separator + item.str + (item.hasEOL ? "\n" : " ");
      }).join("") ?? "";
      pages.push({ image: result, text });
      page.cleanup();
    }
    return pages;
  } finally { await task.destroy(); }
}

function abortable<T>(work:Promise<T>,signal:AbortSignal):Promise<T> {
  if(signal.aborted) return Promise.reject(new DOMException("Leitura interrompida.","AbortError"));
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(new DOMException("Leitura interrompida.","AbortError"));
    signal.addEventListener("abort",abort,{once:true});
    work.then(resolve,reject).finally(()=>signal.removeEventListener("abort",abort));
  });
}

export async function scanClientDocument(files:File[],signal:AbortSignal,onProgress:(message:string)=>void) {
  if(files.length<1||files.length>2||files.some(file=>!file.size||file.size>identityFileLimit||!identityFileTypes.includes(file.type))) {
    throw new Error("Escolhe até dois ficheiros JPG, PNG, WebP ou PDF, até 15 MB cada.");
  }
  const pages:ScanPage[]=[];
  let worker:OcrWorker|undefined;
  try {
    onProgress("A preparar o documento…");
    for(const file of files) {
      signal.throwIfAborted();
      if(pages.length>=2) throw new Error("Seleciona até duas páginas ou faces do mesmo documento.");
      if(file.type==="application/pdf") pages.push(...await pdfPages(file,2-pages.length));
      else pages.push({ image: await imagePage(file), text: "" });
    }
    signal.throwIfAborted();
    onProgress("A carregar o leitor de documentos…");
    const {createWorker,OEM,PSM}=await import("tesseract.js");
    const initialization=createWorker(["por","eng"],OEM.LSTM_ONLY,{
      workerPath:assets+"/worker.min.js",corePath:assets+"/core",langPath:assets+"/lang",
      workerBlobURL:false,cacheMethod:"none",
    });
    void initialization.then(instance=>{if(signal.aborted)void instance.terminate();},()=>{});
    worker=await abortable(initialization,signal);
    const readings: DocumentReading[] = [];
    const today=lisbonDay(new Date().toISOString());
    for(let index=0;index<pages.length;index++) {
      onProgress("A ler página "+(index+1)+" de "+pages.length+"…");
      await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,tessedit_char_whitelist:""});
      const { image: page, text } = pages[index];
      const scans = [text, (await abortable(worker.recognize(page),signal)).data.text].filter(Boolean);
      const reading = readIdentityPage(scans, today);
      if (reading.document_type && reading.full_name && reading.birth_date && reading.expires_on && reading.document_number) {
        readings.push(reading);
        continue;
      }
      const top=Math.floor(page.height*0.55);
      const {result,context}=canvas(page.width,page.height-top);
      context.drawImage(page,0,top,page.width,page.height-top,0,0,result.width,result.height);
      try {
        await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,tessedit_char_whitelist:"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"});
        scans.push((await abortable(worker.recognize(result),signal)).data.text);
      } finally {result.width=0;result.height=0;}
      readings.push(readIdentityPage(scans, today));
    }
    return combineIdentityPages(readings);
  } finally {
    if(worker) await worker.terminate().catch(()=>{});
    for(const { image } of pages) {image.width=0;image.height=0;}
  }
}
