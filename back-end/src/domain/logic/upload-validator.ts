import type { UploadKind } from "@/domain/entities/document";

export interface UploadDescriptor {
  name: string;
  type?: string;
  size?: number;
}

export type ValidationResult =
  | { ok: true; kind: UploadKind }
  | { ok: false; error: string };

/**
 * Decides whether an uploaded file is acceptable and what kind it is.
 *
 * Encapsulates the acceptance policy: PDF only, under the size ceiling. Pure —
 * it inspects metadata only, never the bytes.
 */
export class UploadValidator {
  static readonly MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

  /** Validates an upload's name, size, and type. */
  validate(file: UploadDescriptor): ValidationResult {
    if (!file.name.trim()) {
      return { ok: false, error: "Choose a PDF file." };
    }
    if (
      typeof file.size === "number" &&
      file.size > UploadValidator.MAX_UPLOAD_BYTES
    ) {
      return { ok: false, error: "Files must be 25MB or smaller." };
    }
    const kind = this.detectKind(file);
    if (!kind) {
      return {
        ok: false,
        error: "Only searchable PDF files are supported."
      };
    }
    return { ok: true, kind };
  }

  /** Classifies an upload by extension and MIME type. PDF only. */
  detectKind(file: UploadDescriptor): UploadKind | null {
    const extension = this.extensionOf(file.name);
    const mimeType = (file.type ?? "").toLowerCase();

    if (extension === "pdf" || mimeType === "application/pdf") {
      return "pdf";
    }
    return null;
  }

  /** The default MIME type for a kind, used when the client sent none. */
  defaultContentType(_kind: UploadKind): string {
    return "application/pdf";
  }

  private extensionOf(fileName: string): string {
    const lower = fileName.toLowerCase();
    const lastPart = lower.split(".").pop();
    return lastPart === lower ? "" : lastPart ?? "";
  }
}
