import * as pdfjs from "pdfjs-dist";
// Bundled by Vite, served as a static asset — same approach the pdf.js examples use.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// pdfjs v5 loads JBig2 / OpenJPEG / QCMS as external .wasm files. The vite
// `pdfjs-wasm` plugin publishes them under this path; pdf.js needs a URL with
// a trailing slash so it can append the file names itself.
export const pdfjsWasmUrl = new URL("/pdfjs-wasm/", window.location.origin).toString();

export { pdfjs };
