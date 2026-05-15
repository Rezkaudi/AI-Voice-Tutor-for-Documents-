import { describe, expect, it } from "vitest";
import {
  chunkDocumentPages,
  detectUploadKind,
  validateUploadFile
} from "./documents";

describe("upload validation", () => {
  it("accepts PDF, text, and markdown files under the MVP size limit", () => {
    expect(detectUploadKind({ name: "lesson.pdf", type: "application/pdf" })).toBe("pdf");
    expect(detectUploadKind({ name: "notes.txt", type: "text/plain" })).toBe("text");
    expect(detectUploadKind({ name: "outline.md", type: "text/markdown" })).toBe("markdown");
  });

  it("rejects unsupported files and files larger than 25MB", () => {
    expect(validateUploadFile({ name: "slides.pptx", type: "application/vnd.ms-powerpoint", size: 1200 }).ok).toBe(false);
    expect(validateUploadFile({ name: "big.pdf", type: "application/pdf", size: 26 * 1024 * 1024 }).ok).toBe(false);
  });
});

describe("chunkDocumentPages", () => {
  it("creates page-aware chunks with readable snippets", () => {
    const pages = [
      {
        pageNumber: 3,
        text: "Photosynthesis converts light energy into chemical energy. Chlorophyll absorbs light in plant cells."
      }
    ];

    const chunks = chunkDocumentPages(pages, { maxChars: 48, overlapChars: 12 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.pageNumber === 3)).toBe(true);
    expect(chunks[0].snippet).toContain("Photosynthesis");
    expect(chunks[1].text).toContain("chemical");
  });

  it("skips blank pages", () => {
    const chunks = chunkDocumentPages([
      { pageNumber: 1, text: "   " },
      { pageNumber: 2, text: "Useful content" }
    ]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].pageNumber).toBe(2);
  });
});
