import { randomUUID } from "node:crypto";
import type {
  DocumentChunk,
  DocumentPage,
  UploadKind
} from "@/domain/entities/document";
import { normalizeText } from "@/shared/text";

/**
 * Pure document-processing logic: upload validation, page chunking, and
 * filename helpers. No I/O — text is handed in, chunks come out.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface UploadDescriptor {
  name: string;
  type?: string;
  size?: number;
}

export type ValidationResult =
  | { ok: true; kind: UploadKind }
  | { ok: false; error: string };

interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

const MARKDOWN_TYPES = new Set(["text/markdown", "text/x-markdown"]);

/** Classifies an upload by extension and MIME type. */
export function detectUploadKind(file: UploadDescriptor): UploadKind | null {
  const extension = extensionOf(file.name);
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
    MARKDOWN_TYPES.has(mimeType)
  ) {
    return "markdown";
  }
  return null;
}

/** Validates an upload's name, size, and type. */
export function validateUploadFile(file: UploadDescriptor): ValidationResult {
  if (!file.name.trim()) {
    return { ok: false, error: "Choose a PDF, text, or markdown file." };
  }
  if (typeof file.size === "number" && file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Files must be 25MB or smaller for this MVP." };
  }
  const kind = detectUploadKind(file);
  if (!kind) {
    return {
      ok: false,
      error: "This MVP supports searchable PDFs, .txt, and .md files."
    };
  }
  return { ok: true, kind };
}

/** Splits pages into overlapping, embeddable chunks. */
export function chunkDocumentPages(
  pages: Array<
    Pick<DocumentPage, "pageNumber" | "text"> &
      Partial<Pick<DocumentPage, "documentId">>
  >,
  options: ChunkOptions = {}
): DocumentChunk[] {
  const maxChars = options.maxChars ?? 1600;
  const overlapChars = Math.min(
    options.overlapChars ?? 220,
    Math.floor(maxChars / 2)
  );
  const chunks: DocumentChunk[] = [];

  for (const page of pages) {
    const normalized = normalizeText(page.text);
    if (!normalized) {
      continue;
    }
    for (const segment of splitTextWithOverlap(normalized, maxChars, overlapChars)) {
      chunks.push({
        id: randomUUID(),
        documentId: page.documentId ?? "",
        pageNumber: page.pageNumber,
        chunkIndex: chunks.length,
        text: segment,
        snippet: makeSnippet(segment)
      });
    }
  }
  return chunks;
}

/** Strips a filename down to safe characters. */
export function safeFileName(fileName: string): string {
  const cleaned = fileName
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
  return cleaned.replace(/^-|-$/g, "") || "document";
}

/** Derives a human title from an upload filename. */
export function titleFromFileName(fileName: string): string {
  return (
    safeFileName(fileName)
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim() || "Untitled document"
  );
}

function splitTextWithOverlap(
  text: string,
  maxChars: number,
  overlapChars: number
): string[] {
  if (text.length <= maxChars) {
    return [text];
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const roughEnd = Math.min(start + maxChars, text.length);
    const end =
      roughEnd === text.length
        ? roughEnd
        : findSoftBoundary(text, start, roughEnd);
    const chunk = text.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    if (end >= text.length) {
      break;
    }
    start = Math.max(end - overlapChars, start + 1);
  }
  return chunks;
}

function findSoftBoundary(text: string, start: number, roughEnd: number): number {
  const windowStart = Math.max(start + 1, roughEnd - 160);
  const slice = text.slice(windowStart, roughEnd);
  const sentenceBreak = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("! ")
  );
  if (sentenceBreak > -1) {
    return windowStart + sentenceBreak + 1;
  }
  const wordBreak = text.lastIndexOf(" ", roughEnd);
  return wordBreak > start ? wordBreak : roughEnd;
}

function makeSnippet(text: string): string {
  const normalized = normalizeText(text);
  return normalized.length <= 240
    ? normalized
    : `${normalized.slice(0, 237).trim()}...`;
}

function extensionOf(fileName: string): string {
  const lower = fileName.toLowerCase();
  const lastPart = lower.split(".").pop();
  return lastPart === lower ? "" : lastPart ?? "";
}
