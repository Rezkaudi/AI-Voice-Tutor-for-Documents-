export class FileNaming {
  safe(fileName: string): string {
    const cleaned = fileName
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-");
    return cleaned.replace(/^-|-$/g, "") || "document";
  }

  toTitle(fileName: string): string {
    return (
      this.safe(fileName)
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim() || "Untitled document"
    );
  }
}
