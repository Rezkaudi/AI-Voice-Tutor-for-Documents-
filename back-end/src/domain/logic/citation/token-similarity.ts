export class TokenSimilarity {
  tokenize(value: string): Set<string> {
    return new Set(
      foldArabic(value.toLowerCase())
        .match(/[\p{L}\p{N}]+/gu)
        ?.filter((word) => word.length > 2) ?? []
    );
  }

  /** Jaccard index |a ∩ b| / |a ∪ b|; 0 when either set is empty. */
  jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) {
      return 0;
    }
    let intersection = 0;
    for (const value of a) {
      if (b.has(value)) intersection += 1;
    }
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}

/** Strip Arabic diacritics + tatweel (each maps to "" in this table). */
const ARABIC_FOLD: Record<string, string> = {
  // Alef variants (hamza/madda/wasla) → bare alef.
  "آ": "ا", "أ": "ا", "إ": "ا", "ٱ": "ا",
  // Alef maksura → yeh; teh marbuta → heh — the usual search-time equivalences.
  "ى": "ي", "ة": "ه"
};
// Harakat, superscript alef, Quranic marks, and tatweel — all dropped.
const ARABIC_STRIP = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

function foldArabic(value: string): string {
  if (!/[؀-ۿ]/.test(value)) return value;
  let out = "";
  for (const ch of value.replace(ARABIC_STRIP, "")) {
    out += ARABIC_FOLD[ch] ?? ch;
  }
  return out;
}
