const MAX_TITLE_LENGTH = 200;

export class FileNaming {
  safe(fileName: string): string {
    const cleaned = String(fileName ?? "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-");
    return cleaned.replace(/^-|-$/g, "").slice(0, MAX_TITLE_LENGTH) || "document";
  }

  toTitle(fileName: string): string {
    const title = String(fileName ?? "")
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TITLE_LENGTH)
      .trim();
    return title || "Untitled document";
  }
}
