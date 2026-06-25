import type { Citation } from "@/domain/entities/chat";
import type { DocumentPage } from "@/domain/entities/document";
import type { TextTokenizer } from "@/domain/logic/text-tokenizer";
import type { SentenceSplitter } from "@/domain/logic/citation/sentence-splitter";

export class AnswerAutoCiter {
  private static readonly MIN_OVERLAP = 2;

  constructor(
    private readonly tokenizer: TextTokenizer,
    private readonly sentenceSplitter: SentenceSplitter
  ) { }

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
