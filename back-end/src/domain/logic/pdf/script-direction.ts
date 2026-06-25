export class ScriptDirection {
  /** Strong RTL characters: Arabic and Hebrew, base and presentation blocks. */
  private static readonly RTL_CHARS = /[\u0590-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;
  /** Strong LTR letters: Latin, Greek, Cyrillic, and CJK (all read left→right). */
  private static readonly LTR_CHARS = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u3040-\u30FF\u3400-\u9FFF]/g;

  isRightToLeft(text: string): boolean {
    const rtl = text.match(ScriptDirection.RTL_CHARS)?.length ?? 0;
    const ltr = text.match(ScriptDirection.LTR_CHARS)?.length ?? 0;
    return rtl > ltr;
  }
}
