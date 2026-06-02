import type { Citation } from "@/domain/entities/chat";
import type { DocumentPage } from "@/domain/entities/document";
import type { TextTokenizer } from "@/domain/logic/text-tokenizer";
import type { SentenceSplitter } from "@/domain/logic/citation/sentence-splitter";

/**
 * Last-resort citation fallback when the model skips `cite_passages` (the
 * cost-saving model frequently does).
 *
 * Splits the cited page into sentences, scores each against the tutor's spoken
 * answer by keyword overlap, and returns the top scorers as synthesised
 * citations so the UI still has something to highlight. Returns `[]` when
 * nothing clears the floor.
 */
export class AnswerAutoCiter {
  private static readonly MIN_OVERLAP = 2;

  constructor(
    private readonly tokenizer: TextTokenizer,
    private readonly sentenceSplitter: SentenceSplitter
  ) {}

  cite(answer: string, page: DocumentPage, maxCitations: number = 2): Citation[] {
    const answerTerms = new Set(this.tokenizer.tokenize(answer));
    if (answerTerms.size === 0) {
      return [];
    }
    const sentences = this.sentenceSplitter.split(page.text);
    if (sentences.length === 0) {
      return [];
    }

    return sentences
      .map((sentence) => {
        const terms = new Set(this.tokenizer.tokenize(sentence.text));
        let overlap = 0;
        for (const term of terms) {
          if (answerTerms.has(term)) overlap += 1;
        }
        // Normalise by sentence size so one long sentence doesn't always win on
        // raw count alone.
        const score = terms.size === 0 ? 0 : overlap / Math.sqrt(terms.size);
        return { sentence, overlap, score };
      })
      .filter((entry) => entry.overlap >= AnswerAutoCiter.MIN_OVERLAP)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCitations)
      .map((entry) => ({
        pageNumber: page.pageNumber,
        start: entry.sentence.start,
        end: entry.sentence.end,
        quote: page.text.slice(entry.sentence.start, entry.sentence.end)
      }));
  }
}
