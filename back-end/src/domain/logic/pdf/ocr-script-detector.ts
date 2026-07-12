export interface OcrRecognitionSample {
  text: string;
  confidence: number;
}

export class OcrScriptDetector {
  private static readonly MIN_CONFIDENCE = 0.5;
  private static readonly MIN_CONFIDENT_BOXES = 8;
  private static readonly MAX_LETTERS_PER_BOX = 1.5;

  defaultModelFailed(samples: readonly OcrRecognitionSample[]): boolean {
    const confident = samples.filter(
      (sample) => sample.confidence >= OcrScriptDetector.MIN_CONFIDENCE
    );
    if (confident.length < OcrScriptDetector.MIN_CONFIDENT_BOXES) return false;

    const letters = confident.reduce((total, sample) => total + this.letterCount(sample.text), 0);
    return letters / confident.length < OcrScriptDetector.MAX_LETTERS_PER_BOX;
  }

  private letterCount(text: string): number {
    return (text.match(/\p{L}/gu) ?? []).length;
  }
}
