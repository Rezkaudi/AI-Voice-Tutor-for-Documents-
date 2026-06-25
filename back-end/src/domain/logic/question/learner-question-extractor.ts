export class LearnerQuestionExtractor {
  private static readonly ASK_BLOCK = /\[\[ASK\]\]([\s\S]*?)(?:\[\[\/ASK\]\]|$)/;
  private static readonly ASK_DELIMITER = /\[\[\/?ASK\]\]/g;
  private static readonly CITATION = /\[\[\d+\]\]/g;

  extract(text: string): { text: string; question: string | null } {
    const match = text.match(LearnerQuestionExtractor.ASK_BLOCK);
    const question = match ? this.cleanQuestion(match[1] ?? "") : null;

    const spoken = text
      .replace(LearnerQuestionExtractor.ASK_DELIMITER, "")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

    return { text: spoken, question: question || null };
  }

  private cleanQuestion(raw: string): string {
    return raw
      .replace(LearnerQuestionExtractor.CITATION, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/(^|\W)\*(.+?)\*(?=\W|$)/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim();
  }
}
