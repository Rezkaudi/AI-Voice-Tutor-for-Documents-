import * as pdfjs from "pdfjs-dist";

import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const pdfjsWasmUrl = new URL("/pdfjs-wasm/", window.location.origin).toString();

export { pdfjs };
