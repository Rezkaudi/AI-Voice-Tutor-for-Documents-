import type { Reference } from "@/domain/entities/chat";

/**
 * Keeps the inline `[[N]]` markers and the citations panel in lockstep.
 *
 * The model can record more citations than it actually marks in the text (e.g.
 * 5 in `cite_passages`, but only `[[1]]` and `[[2]]` appear in the answer).
 * Left alone, the side panel shows references the student can never click. This
 * drops the unreferenced citations and renumbers the survivors to `[[1]]…[[K]]`
 * so text and panel always match.
 */
export class CitationMarkerReconciler {
  private static readonly MARKER = /\[\[(\d+)\]\]/g;

  reconcile(
    text: string,
    reference: Reference | null
  ): { text: string; reference: Reference | null } {
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

    // Always rewrite so any out-of-range marker (e.g. [[5]] when only 4 were
    // recorded) is stripped, even if the kept markers already form 1..K.
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
