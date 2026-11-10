import {cp,mkdir,readdir,copyFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";

const require=createRequire(import.meta.url);
const output=fileURLToPath(new URL("../public/ocr-assets/",import.meta.url));
const core=dirname(require.resolve("tesseract.js-core/package.json"));
const pdf=dirname(require.resolve("pdfjs-dist/package.json"));
const tesseract=dirname(require.resolve("tesseract.js/package.json"));
await Promise.all(["core","lang","pdf"].map(folder=>mkdir(join(output,folder),{recursive:true})));
await Promise.all([
  copyFile(join(tesseract,"dist/worker.min.js"),join(output,"worker.min.js")),
  copyFile(join(pdf,"legacy/build/pdf.worker.min.mjs"),join(output,"pdf/pdf.worker.min.mjs")),
  ...["wasm","cmaps","standard_fonts","iccs"].map(folder=>cp(join(pdf,folder),join(output,"pdf",folder),{recursive:true})),
  ...(await readdir(core)).filter(name=>/lstm\.wasm(?:\.js)?$/.test(name)).map(name=>copyFile(join(core,name),join(output,"core",name))),
  ...["por","eng"].map(lang=>{
    const folder=dirname(require.resolve("@tesseract.js-data/"+lang+"/package.json"));
    return copyFile(join(folder,"4.0.0_best_int",lang+".traineddata.gz"),join(output,"lang",lang+".traineddata.gz"));
  }),
]);
