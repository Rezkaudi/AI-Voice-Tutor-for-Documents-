import { pdfjs } from "@/lib/pdfWorker";

export async function countPdfPages(file: File): Promise<number> {
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const pdf = await task.promise;
  try {
    return pdf.numPages;
  } finally {
    await pdf.destroy();
  }
}
