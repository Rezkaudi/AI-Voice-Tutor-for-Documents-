export interface PdfCompressionResult {
  readonly body: Buffer;
  readonly compressed: boolean;
  readonly bytesBefore: number;
  readonly bytesAfter: number;
  readonly skippedReason?:
  | "disabled"
  | "below-threshold"
  | "no-gain"
  | "page-count-changed"
  | "failed";
}

export interface PdfCompressor {
  compress(source: Buffer): Promise<PdfCompressionResult>;
}
