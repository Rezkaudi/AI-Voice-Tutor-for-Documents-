import type { Reference } from "@/domain/entities/chat";

export class CitationMarkerReconciler {
  private static readonly MARKER = /\[\[(\d+)\]\]/g;

  reconcile(text: string, reference: Reference | null): { text: string; reference: Reference | null } {

    if (!reference || reference.citations.length === 0) {
      return { text, reference };
    }

    const used: number[] = [];

    for (const match of text.matchAll(CitationMarkerReconciler.MARKER)) {
      const n = Number(match[1]);
      if (
        Number.isFinite(n) &&
        n >= 1 &&
        n <= reference.citations.length &&
        !used.includes(n)
      ) {
        used.push(n);
      }
    }

    const remap = new Map<number, number>();
    used.forEach((oldIdx, i) => remap.set(oldIdx, i + 1));

    const remappedText = text.replace(CitationMarkerReconciler.MARKER, (_, raw) => {
      const next = remap.get(Number(raw));
      return next ? `[[${next}]]` : "";
    });
    const remappedCitations = used.map((oldIdx) => reference.citations[oldIdx - 1]!);

    return {
      text: remappedText,
      reference: { ...reference, citations: remappedCitations }
    };
  }
}
