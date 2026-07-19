export interface DocumentPagesFile {
  readonly version: 1;
  readonly pageCount: number;
  readonly done: boolean;
  readonly pages: Record<string, string>;
  readonly failed: number[];
}
