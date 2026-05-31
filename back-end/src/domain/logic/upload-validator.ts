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
 * Encapsulates the MVP's acceptance policy: supported formats (PDF, plain text,
 * markdown) and the size ceiling. Pure — it inspects metadata only, never the
 * bytes.
 */
export class UploadValidator {
  static readonly MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

  private static readonly MARKDOWN_TYPES = new Set([
    "text/markdown",
    "text/x-markdown"
  ]);

  /** Validates an upload's name, size, and type. */
  validate(file: UploadDescriptor): ValidationResult {
    if (!file.name.trim()) {
      return { ok: false, error: "Choose a PDF, text, or markdown file." };
    }
    if (
      typeof file.size === "number" &&
      file.size > UploadValidator.MAX_UPLOAD_BYTES
    ) {
      return { ok: false, error: "Files must be 25MB or smaller for this MVP." };
    }
    const kind = this.detectKind(file);
    if (!kind) {
      return {
        ok: false,
        error: "This MVP supports searchable PDFs, .txt, and .md files."
      };
    }
    return { ok: true, kind };
  }

  /** Classifies an upload by extension and MIME type. */
  detectKind(file: UploadDescriptor): UploadKind | null {
    const extension = this.extensionOf(file.name);
    const mimeType = (file.type ?? "").toLowerCase();

    if (extension === "pdf" || mimeType === "application/pdf") {
      return "pdf";
    }
    if (extension === "txt" || mimeType.startsWith("text/plain")) {
      return "text";
    }
    if (
      extension === "md" ||
      extension === "markdown" ||
      UploadValidator.MARKDOWN_TYPES.has(mimeType)
    ) {
      return "markdown";
    }
    return null;
  }

  private extensionOf(fileName: string): string {
    const lower = fileName.toLowerCase();
    const lastPart = lower.split(".").pop();
    return lastPart === lower ? "" : lastPart ?? "";
  }
}
