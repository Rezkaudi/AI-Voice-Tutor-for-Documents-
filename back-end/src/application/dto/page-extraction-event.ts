export type PageExtractionEvent =
  | {
    event: "progress";
    data: {
      pageCount: number;
      extracted: number[];
      failed: number[];
      extracting: number[];
      done: boolean;
    };
  }
  | { event: "page-start"; data: { page: number } }
  | { event: "page-ready"; data: { page: number } }
  | { event: "page-failed"; data: { page: number } }
  | { event: "done"; data: Record<string, never> }
  | { event: "ping"; data: Record<string, never> }
  | { event: "error"; data: { error: string } };
