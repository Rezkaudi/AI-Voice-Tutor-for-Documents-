export class RtlVisualOrderConverter {
  private static readonly LTR_RUN = /[0-9A-Za-z٠-٩۰-۹]+/gu;
  private static readonly MIRROR: Readonly<Record<string, string>> = {
    "(": ")", ")": "(",
    "[": "]", "]": "[",
    "{": "}", "}": "{",
    "<": ">", ">": "<",
    "«": "»", "»": "«"
  };

  toLogical(visual: string): string {
    const mirrored = Array.from(visual, (char) => RtlVisualOrderConverter.MIRROR[char] ?? char);
    const reversed = mirrored.reverse().join("");
    return reversed.replace(RtlVisualOrderConverter.LTR_RUN, (run) =>
      Array.from(run).reverse().join("")
    );
  }
}
