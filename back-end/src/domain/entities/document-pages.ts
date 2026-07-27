export interface DocumentPagesFile {
  readonly version: 1;
  readonly pageCount: number;
  readonly done: boolean;
  readonly pages: Record<string, string>;
  readonly failed: number[];
  readonly attempts: Record<string, number>;
}

export function pageAttempts(file: DocumentPagesFile | null, page: number): number {
  return file?.attempts?.[String(page)] ?? 0;
}

export function isPageExtracted(file: DocumentPagesFile | null, page: number): boolean {
  return !!file && file.pages[String(page)] !== undefined;
}

export function isPageExhausted(
  file: DocumentPagesFile | null,
  page: number,
  maxAttempts: number
): boolean {
  if (!file) return false;
  return file.failed.includes(page) && pageAttempts(file, page) >= maxAttempts;
}

export function isPageSettled(
  file: DocumentPagesFile | null,
  page: number,
  maxAttempts: number
): boolean {
  return isPageExtracted(file, page) || isPageExhausted(file, page, maxAttempts);
}

export function extractedPages(file: DocumentPagesFile | null): number[] {
  if (!file) return [];
  return Object.keys(file.pages)
    .map(Number)
    .filter((page) => Number.isInteger(page) && page >= 1)
    .sort((a, b) => a - b);
}

export function pagesNeedingWork(
  file: DocumentPagesFile | null,
  pageCount: number,
  maxAttempts: number
): number[] {
  const pages: number[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    if (!isPageSettled(file, page, maxAttempts)) pages.push(page);
  }
  return pages;
}
