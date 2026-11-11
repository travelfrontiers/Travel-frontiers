import {lisbonDay} from "./crm-calendar";
import {combineIdentityPages, missingIdentityFields, readIdentityPage, type DocumentReading} from "./crm-document-ocr";
import type {PSM as OcrPageMode, Worker as OcrWorker} from "tesseract.js";

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

function rotatePage(page: HTMLCanvasElement, angle: 90 | -90 | 180) {
  const {result,context} = angle === 180 ? canvas(page.width,page.height) : canvas(page.height,page.width);
  context.translate(result.width / 2,result.height / 2);
  context.rotate(angle * Math.PI / 180);
  context.drawImage(page,-page.width / 2,-page.height / 2);
  return result;
}

function trimPageMargins(page: HTMLCanvasElement) {
  const scale = 256 / Math.max(page.width,page.height);
  const {result: thumbnail,context: preview} = canvas(page.width * scale,page.height * scale);
  const {width,height} = thumbnail;
  preview.drawImage(page,0,0,width,height);
  const {data} = preview.getImageData(0,0,width,height);
  const rows = new Uint16Array(height);
  const columns = new Uint16Array(width);
  for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
    const pixel = (y * width + x) * 4;
    if (Math.min(data[pixel],data[pixel+1],data[pixel+2]) >= 175) continue;
    rows[y]++;
    columns[x]++;
  }
  thumbnail.width = 0;
  thumbnail.height = 0;
  const rowMin = Math.max(3, Math.ceil(width * .014));
  const columnMin = Math.max(3, Math.ceil(height * .014));
  const left = Math.max(0, columns.findIndex(count => count >= columnMin) / width - .025);
  const right = Math.min(1, (columns.findLastIndex(count => count >= columnMin) + 1) / width + .025);
  const top = Math.max(0, rows.findIndex(count => count >= rowMin) / height - .025);
  const bottom = Math.min(1, (rows.findLastIndex(count => count >= rowMin) + 1) / height + .025);
  const widthRatio = right - left;
  const heightRatio = bottom - top;
  if (widthRatio < .28 || heightRatio < .25 || widthRatio * heightRatio > .82) return null;
  const cropWidth = page.width * widthRatio;
  const cropHeight = page.height * heightRatio;
  const zoom = Math.min(2, 2400 / Math.max(cropWidth,cropHeight));
  const {result,context} = canvas(cropWidth * zoom,cropHeight * zoom);
  context.drawImage(page,page.width * left,page.height * top,cropWidth,cropHeight,0,0,result.width,result.height);
  return result;
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

function isCompleteReading(reading: DocumentReading) {
  return Boolean(reading.document_type && reading.full_name && reading.birth_date && reading.expires_on && reading.document_number);
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
      let best = readIdentityPage(scans, today);
      let orientedPage = page;
      try {
        if (!best.full_name && !best.document_number && (!best.birth_date || !best.expires_on)) {
          for (const angle of [90, -90, 180] as const) {
            onProgress("A verificar a orientação do documento…");
            const rotated = rotatePage(page,angle);
            try {
              const rotatedText = (await abortable(worker.recognize(rotated),signal)).data.text;
              const reading = readIdentityPage([text,rotatedText],today);
              if (missingIdentityFields(reading).length >= missingIdentityFields(best).length) continue;
              if (orientedPage !== page) {orientedPage.width=0;orientedPage.height=0;}
              orientedPage = rotated;
              best = reading;
              scans.splice(0,scans.length,...[text,rotatedText].filter(Boolean));
              if (isCompleteReading(best)) break;
            } finally {
              if (orientedPage !== rotated) {rotated.width=0;rotated.height=0;}
            }
          }
        }
        if (!isCompleteReading(best)) {
          onProgress("A verificar os campos do documento…");
          const cropped = trimPageMargins(orientedPage);
          if (cropped) {
            try {
              const cropText = (await abortable(worker.recognize(cropped),signal)).data.text;
              scans.push(cropText);
              best = readIdentityPage(scans,today);
              if (!isCompleteReading(best)) best = await readMachineZone(worker,PSM.SINGLE_BLOCK,cropped,scans,best,today,signal);
            } finally { cropped.width=0; cropped.height=0; }
          }
          if (!isCompleteReading(best)) best = await readMachineZone(worker,PSM.SINGLE_BLOCK,orientedPage,scans,best,today,signal);
        }
        readings.push(best);
      } finally {
        if (orientedPage !== page) {orientedPage.width=0;orientedPage.height=0;}
      }
    }
    return combineIdentityPages(readings);
  } finally {
    if(worker) await worker.terminate().catch(()=>{});
    for(const { image } of pages) {image.width=0;image.height=0;}
  }
}

async function readMachineZone(worker: OcrWorker, mode: OcrPageMode, page: HTMLCanvasElement, scans: string[], reading: DocumentReading, today: string, signal: AbortSignal) {
  let best = reading;
  // Start with the MRZ itself so the printed fields above it do not interfere.
  // The wider crop also covers photos with extra space beneath the document.
  await worker.setParameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"});
  const zoom = Math.min(2, 2400 / page.width);
  const crops = [
    { start: 0.85, scale: zoom },
    { start: 0.85, scale: zoom, contrast: true },
    { start: 0.85, scale: 1 },
    { start: 0.88, scale: zoom },
    { start: 0.82, scale: zoom, contrast: true },
    { start: 0.55, scale: 1 },
  ];
  for (const { start, scale, contrast } of crops) {
    const top = Math.floor(page.height * start);
    const height = page.height - top;
    const {result,context} = canvas(page.width * scale, height * scale);
    try {
      if (contrast) context.filter = "grayscale(1) contrast(1.6)";
      context.drawImage(page,0,top,page.width,height,0,0,result.width,result.height);
      scans.push((await abortable(worker.recognize(result),signal)).data.text);
      best = readIdentityPage(scans, today);
    } finally {result.width=0;result.height=0;}
    if (isCompleteReading(best)) break;
  }
  return best;
}
