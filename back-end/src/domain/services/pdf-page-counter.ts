export interface PdfPageCounter {
  countPages(pdf: Buffer): Promise<number>;
}
