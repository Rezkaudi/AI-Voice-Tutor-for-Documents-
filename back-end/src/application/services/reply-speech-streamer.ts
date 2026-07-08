import type { StreamEvent } from "@/application/dto/stream-event";
import type { AiUsage } from "@/domain/services/ai-usage";
import type { SpeechSynthesisService } from "@/domain/services/speech-services";
import type { Logger } from "@/domain/services/logger";

const MAX_TTS_CHARS = 4000;
const CITATION_MARKER = /\[\[(\d+)\]\]/g;

export class ReplySpeechStreamer {
  private chain: Promise<void> = Promise.resolve();
  private readonly usages: AiUsage[] = [];
  private nextId = 0;

  constructor(
    private readonly speech: SpeechSynthesisService,
    private readonly emit: (event: StreamEvent) => void,
    private readonly signal: AbortSignal,
    private readonly log: Logger
  ) { }

  /** Queues one sentence; returns immediately. Markers ride along for citation sync. */
  speak(sentence: string): void {
    const text = spokenTextOf(sentence);
    if (!text) return;
    const markers = uniqueMarkerIndices(sentence);
    const id = this.nextId += 1;
    this.chain = this.chain.then(() => this.synthesize(id, text, markers));
  }

  /** Resolves when all queued audio has been emitted; returns total TTS usage. */
  async finish(): Promise<AiUsage | null> {
    await this.chain;
    if (this.usages.length === 0) return null;
    return this.usages.reduce((sum, usage) => ({
      model: usage.model,
      inputTokens: sum.inputTokens + usage.inputTokens,
      outputTokens: sum.outputTokens + usage.outputTokens
    }));
  }

  private async synthesize(id: number, text: string, markers: number[]): Promise<void> {
    if (this.signal.aborted) return;
    this.emit({ event: "speech-start", data: { id, text, markers } });
    try {
      const stream = await this.speech.synthesizeStream(text, this.signal);
      let bytes = 0;
      for await (const chunk of stream.audio) {
        bytes += chunk.length;
        this.emit({ event: "speech-chunk", data: { id, audio: chunk.toString("base64") } });
      }
      this.usages.push(stream.usage);
      this.log.info(`speech #${id} · ${text.length} chars → ${(bytes / 1024).toFixed(1)} KiB`);
    } catch (error) {
      if (!this.signal.aborted) {
        const reason = error instanceof Error ? error.message : "unknown error";
        this.log.warn(`speech #${id} failed — client will fall back (${reason})`);
      }
    }
    this.emit({ event: "speech-end", data: { id } });
  }
}

function spokenTextOf(sentence: string): string {
  return sentence
    .replace(CITATION_MARKER, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, MAX_TTS_CHARS);
}

function uniqueMarkerIndices(sentence: string): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const match of sentence.matchAll(CITATION_MARKER)) {
    const n = Number(match[1]);
    if (n >= 1 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}
