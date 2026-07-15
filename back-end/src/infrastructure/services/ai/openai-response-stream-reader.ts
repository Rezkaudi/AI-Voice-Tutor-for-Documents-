import type { TutorStreamEvent } from "@/domain/services/tutor-service";

export interface StepUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export interface StreamStep {
  stepText: string;
  usage?: StepUsage;
}

export class OpenAiResponseStreamReader {
  async *read(
    stream: AsyncIterable<Record<string, unknown>>
  ): AsyncGenerator<TutorStreamEvent, StreamStep> {
    const textByOutputIndex = new Map<number, string>();
    let usage: StepUsage | undefined;

    for await (const event of stream) {
      if (
        event.type === "response.output_text.delta" &&
        typeof event.delta === "string"
      ) {
        const index = typeof event.output_index === "number" ? event.output_index : 0;
        textByOutputIndex.set(index, (textByOutputIndex.get(index) ?? "") + event.delta);
        yield { type: "delta", text: event.delta };
      } else if (event.type === "response.completed") {
        const response = event.response as Record<string, unknown> | undefined;
        usage = readUsage(response?.usage);
      }
    }

    const lastIndex = [...textByOutputIndex.keys()].sort((a, b) => a - b).pop();
    const stepText = lastIndex === undefined ? "" : (textByOutputIndex.get(lastIndex) ?? "");

    return { stepText, usage };
  }
}

function readUsage(raw: unknown): StepUsage | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const usage = raw as Record<string, unknown>;
  const inputTokens = Number(usage.input_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? 0);
  if (!Number.isFinite(inputTokens) && !Number.isFinite(outputTokens)) {
    return undefined;
  }
  const details = usage.input_tokens_details as Record<string, unknown> | undefined;
  const cachedInputTokens = Number(details?.cached_tokens ?? 0);
  return {
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    cachedInputTokens: Number.isFinite(cachedInputTokens) ? cachedInputTokens : 0
  };
}
