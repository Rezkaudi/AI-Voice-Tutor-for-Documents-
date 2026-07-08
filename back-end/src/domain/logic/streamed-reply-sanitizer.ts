export class StreamedReplySanitizer {
  private static readonly ASK_DELIMITERS = /\[\[\/?ASK\]\]/g;
  private static readonly CONFIRMED_TRAILER = /^[ \t]*CITATIONS:?[ \t]*(?=\r?\n)/im;
  private static readonly DANGLING_TRAILER = /^\s*CITATIONS:?[ \t]*$/i;
  private static readonly LONGEST_ASK_PREFIX = "[[/ASK]]".length - 1;

  private text = "";
  private cursor = 0;
  private stopped = false;

  push(delta: string): string {
    if (this.stopped) return "";
    this.text += delta;

    const trailer = StreamedReplySanitizer.CONFIRMED_TRAILER.exec(this.text);
    if (trailer) {
      this.stopped = true;
      return this.clean(this.text.slice(this.cursor, trailer.index)).trimEnd();
    }

    // Never end an emission in whitespace: a trailer heading may follow it,
    // and the reply must not pick up trailing blank lines it can't take back.
    let safe = Math.min(this.trailerHoldback(), this.askHoldback());
    while (safe > this.cursor && /\s/.test(this.text[safe - 1]!)) {
      safe -= 1;
    }
    const emitted = this.clean(this.text.slice(this.cursor, safe));
    this.cursor = safe;
    return emitted;
  }

  flush(): string {
    if (this.stopped) return "";
    this.stopped = true;
    const rest = this.text.slice(this.cursor);
    if (StreamedReplySanitizer.DANGLING_TRAILER.test(rest)) return "";
    return this.clean(rest).trimEnd();
  }

  private clean(chunk: string): string {
    return chunk.replace(StreamedReplySanitizer.ASK_DELIMITERS, "");
  }

  /** Holds back the current last line while it could still become "CITATIONS:". */
  private trailerHoldback(): number {
    const lineStart = this.text.lastIndexOf("\n") + 1;
    if (lineStart < this.cursor) return this.text.length;
    const line = this.text.slice(lineStart);
    return this.couldBecomeTrailerHeading(line) ? lineStart : this.text.length;
  }

  private couldBecomeTrailerHeading(line: string): boolean {
    const match = /^[ \t]*([A-Za-z]*:?)([ \t]*)$/.exec(line);
    if (!match) return false;
    const word = match[1]!.toUpperCase();
    if (match[2] && word && word !== "CITATIONS" && word !== "CITATIONS:") {
      return false;
    }
    return "CITATIONS:".startsWith(word);
  }

  /** Holds back a trailing fragment that could still become an ASK delimiter. */
  private askHoldback(): number {
    const max = Math.min(
      StreamedReplySanitizer.LONGEST_ASK_PREFIX,
      this.text.length - this.cursor
    );
    for (let length = max; length >= 1; length -= 1) {
      const suffix = this.text.slice(this.text.length - length);
      if ("[[ASK]]".startsWith(suffix) || "[[/ASK]]".startsWith(suffix)) {
        return this.text.length - length;
      }
    }
    return this.text.length;
  }
}
