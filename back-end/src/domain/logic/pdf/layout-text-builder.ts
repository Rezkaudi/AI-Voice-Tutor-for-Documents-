import type { PositionedTextItem } from "@/domain/logic/pdf/positioned-text-item";
import type { ScriptDirection } from "@/domain/logic/pdf/script-direction";

export class LayoutTextBuilder {
  constructor(private readonly scriptDirection: ScriptDirection) { }

  build(items: PositionedTextItem[]): string {
    return this.normalize(this.itemsToText(items));
  }

  private itemsToText(items: PositionedTextItem[]): string {
    if (items.length === 0) return "";

    const byTop = [...items].sort((a, b) => b.y - a.y);
    const lines: PositionedTextItem[][] = [];
    for (const item of byTop) {
      const current = lines[lines.length - 1];
      const reference = current?.[0];
      const tolerance = Math.max(2, (reference?.height ?? item.height) * 0.5);
      if (current && reference && Math.abs(reference.y - item.y) <= tolerance) {
        current.push(item);
      } else {
        lines.push([item]);
      }
    }

    return lines
      .map((line) => this.orderLineRuns(line).map((run) => run.str).join(" "))
      .join("\n");
  }

  private orderLineRuns(line: PositionedTextItem[]): PositionedTextItem[] {
    const text = line.map((run) => run.str).join("");
    return this.scriptDirection.isRightToLeft(text)
      ? [...line].sort((a, b) => b.x - a.x)
      : [...line].sort((a, b) => a.x - b.x);
  }

  private normalize(text: string): string {
    return text
      .replace(/[^\S\n]+/g, " ") // collapse spaces/tabs but NOT newlines
      .replace(/ *\n */g, "\n") // drop spaces hugging a newline
      .replace(/\n{3,}/g, "\n\n") // cap blank-line runs at one
      .trim();
  }
}
