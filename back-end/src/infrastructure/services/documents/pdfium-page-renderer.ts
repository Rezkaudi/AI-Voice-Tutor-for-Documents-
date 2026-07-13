import { createCanvas, ImageData } from "@napi-rs/canvas";
import type { PDFiumLibrary as PdfiumLibraryType } from "@hyzyla/pdfium";

export interface RenderedPage {
  pageNumber: number;
  png: ArrayBuffer;
}

export class PdfiumPageRenderer {
  private static readonly DPI = 150;

  private libraryPromise: Promise<PdfiumLibraryType> | null = null;

  async countPages(buffer: Buffer): Promise<number> {
    return this.withDocument(buffer, async (document) => document.getPageCount());
  }

  async renderPages(buffer: Buffer, pageNumbers: number[]): Promise<RenderedPage[]> {
    return this.withDocument(buffer, async (document) => {
      const total = document.getPageCount();
      const wanted = Array.from(new Set(pageNumbers))
        .filter((pageNumber) => pageNumber >= 1 && pageNumber <= total)
        .sort((a, b) => a - b);

      const scale = PdfiumPageRenderer.DPI / 72;
      return Promise.all(
        wanted.map(async (pageNumber) => {
          const page = document.getPage(pageNumber - 1);
          const bitmap = await page.render({ scale, colorSpace: "Gray" });
          return {
            pageNumber,
            png: await this.encodePng(bitmap.data, bitmap.width, bitmap.height)
          };
        })
      );
    });
  }

  private async withDocument<T>(
    buffer: Buffer,
    work: (document: Awaited<ReturnType<PdfiumLibraryType["loadDocument"]>>) => Promise<T>
  ): Promise<T> {
    const library = await this.library();
    const document = await library.loadDocument(new Uint8Array(buffer));
    try {
      return await work(document);
    } finally {
      document.destroy();
    }
  }

  private library(): Promise<PdfiumLibraryType> {
    if (!this.libraryPromise) {
      this.libraryPromise = (async () => {
        const { PDFiumLibrary } = await import("@hyzyla/pdfium");
        return PDFiumLibrary.init();
      })();
    }
    return this.libraryPromise;
  }

  private async encodePng(data: Uint8Array, width: number, height: number): Promise<ArrayBuffer> {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, j = 0; i < data.length; i += 1, j += 4) {
      const gray = data[i]!;
      rgba[j] = gray;
      rgba[j + 1] = gray;
      rgba[j + 2] = gray;
      rgba[j + 3] = 255;
    }
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    context.putImageData(new ImageData(rgba, width, height), 0, 0);
    const png = await canvas.encode("png");
    return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
  }
}
