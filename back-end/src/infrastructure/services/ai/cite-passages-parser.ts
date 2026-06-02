import type { CitationCandidate } from "@/domain/logic/citation-resolver";

/**
 * Parses the OpenAI `cite_passages` tool-call payload into citation candidates.
 *
 * The tool contract is `{ citations: [{ page, quote }] }`. This validates each
 * entry defensively — the model occasionally emits malformed JSON or partial
 * objects — and silently drops anything unusable.
 */
export class CitePassagesParser {
  parse(rawArgs: string): CitationCandidate[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawArgs || "{}");
    } catch {
      return [];
    }
    if (!parsed || typeof parsed !== "object") {
      return [];
    }
    const list = (parsed as { citations?: unknown }).citations;
    if (!Array.isArray(list)) {
      return [];
    }

    const candidates: CitationCandidate[] = [];
    for (const entry of list) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const page = Number((entry as { page?: unknown }).page);
      const quoteRaw = (entry as { quote?: unknown }).quote;
      if (!Number.isInteger(page) || page < 1 || typeof quoteRaw !== "string") {
        continue;
      }
      const quote = quoteRaw.trim();
      if (quote) {
        candidates.push({ pageNumber: page, quote });
      }
    }
    return candidates;
  }
}
