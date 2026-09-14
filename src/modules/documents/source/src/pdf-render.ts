import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc=pdfWorker
export async function renderPdfImages(file:File){const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise,images:string[]=[];for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),viewport=page.getViewport({scale:1.6}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport}).promise;images.push(canvas.toDataURL('image/jpeg',.92))}return images}
