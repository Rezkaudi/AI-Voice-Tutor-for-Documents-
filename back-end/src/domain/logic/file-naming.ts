/**
 * Derives safe storage keys and human titles from upload filenames.
 *
 * Pure string policy: {@link safe} strips a name down to filesystem/URL-safe
 * characters (used to build the object-storage key), {@link toTitle} turns it
 * into a readable document title.
 */
export class FileNaming {
  /** Strips a filename down to safe characters. */
  safe(fileName: string): string {
    const cleaned = fileName
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-");
    return cleaned.replace(/^-|-$/g, "") || "document";
  }

  /** Derives a human title from an upload filename. */
  toTitle(fileName: string): string {
    return (
      this.safe(fileName)
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim() || "Untitled document"
    );
  }
}
