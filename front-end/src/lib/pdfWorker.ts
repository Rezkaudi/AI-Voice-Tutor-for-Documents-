import * as pdfjs from "pdfjs-dist";
// Bundled by Vite, served as a static asset — same approach the pdf.js examples use.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/**
 * Wires pdf.js to its web-worker bundle. Called once at module load so any
 * component that imports from `pdfjs-dist` gets a ready-to-use library.
 */
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjs };
