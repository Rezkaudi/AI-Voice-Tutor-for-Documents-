import type { DocumentPage } from "@/domain/entities/document";

export class HeaderFooterRemover {
  private static readonly MIN_PAGES = 4;
  private static readonly MIN_PHRASE_LEN = 4;
  private static readonly MAX_PHRASE_LEN = 60;
  private static readonly MAX_EDGE_TOKENS = 3;

  remove(pages: DocumentPage[]): DocumentPage[] {
    if (pages.length < HeaderFooterRemover.MIN_PAGES) {
      return pages;
    }

    const trailing = this.countEdgePhrases(pages, "trailing");
    const leading = this.countEdgePhrases(pages, "leading");

    const threshold = Math.max(3, Math.floor(pages.length * 0.3));
    const trailingPhrases = this.frequentPhrases(trailing, threshold);
    const leadingPhrases = this.frequentPhrases(leading, threshold);
    if (trailingPhrases.length === 0 && leadingPhrases.length === 0) {
      return pages;
    }

    const footerPatterns = trailingPhrases.map(
      (phrase) => new RegExp("\\s*" + this.escapeRegExp(phrase) + "\\s*\\d*\\s*$")
    );
    const headerPatterns = leadingPhrases.map(
      (phrase) => new RegExp("^\\s*\\d*\\s*" + this.escapeRegExp(phrase) + "\\s*")
    );

    return pages.map((page) => {
      const kept = page.text
        .split("\n")
        .map((line) => {
          let stripped = line;
          for (const pattern of footerPatterns) stripped = stripped.replace(pattern, "");
          for (const pattern of headerPatterns) stripped = stripped.replace(pattern, "");
          return stripped;
        })
        .filter((line) => line.trim().length > 0);
      return { pageNumber: page.pageNumber, text: kept.join("\n") };
    });
  }

  private countEdgePhrases(
    pages: DocumentPage[],
    edge: "leading" | "trailing"
  ): Map<string, number> {
    const counts = new Map<string, number>();
    for (const page of pages) {
      const lines = page.text.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) continue;
      const edgeLine = edge === "trailing" ? lines[lines.length - 1]! : lines[0]!;
      const tokens = this.withoutEdgeNumbers(edgeLine.split(/\s+/));
      const max = Math.min(HeaderFooterRemover.MAX_EDGE_TOKENS, tokens.length);
      for (let n = 1; n <= max; n += 1) {
        const phrase =
          edge === "trailing"
            ? tokens.slice(tokens.length - n).join(" ")
            : tokens.slice(0, n).join(" ");
        this.bump(counts, phrase);
      }
    }
    return counts;
  }

  private bump(map: Map<string, number>, phrase: string): void {
    if (
      phrase.length >= HeaderFooterRemover.MIN_PHRASE_LEN &&
      phrase.length <= HeaderFooterRemover.MAX_PHRASE_LEN
    ) {
      map.set(phrase, (map.get(phrase) ?? 0) + 1);
    }
  }

  private frequentPhrases(counts: Map<string, number>, threshold: number): string[] {
    return [...counts]
      .filter(([, count]) => count >= threshold)
      .map(([phrase]) => phrase)
      .sort((a, b) => b.length - a.length);
  }

  private withoutEdgeNumbers(tokens: string[]): string[] {
    const copy = [...tokens];
    while (copy.length && /^\d+$/.test(copy[copy.length - 1]!)) copy.pop();
    while (copy.length && /^\d+$/.test(copy[0]!)) copy.shift();
    return copy;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
