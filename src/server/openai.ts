import OpenAI from "openai";
import { appConfig, hasOpenAIConfig } from "@/lib/config";
import {
  buildFallbackAnswer,
  buildTutorInstructions,
  buildTutorUserTurn,
  TUTOR_GENERATION
} from "@/lib/prompts";
import type { ChatMessage, DocumentChunk, DocumentRecord, Reference } from "@/lib/types";

// Character batch size for streaming the local demo-mode answer.
const FALLBACK_STREAM_CHUNK = 36;

let client: OpenAI | null = null;

export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  if (!hasOpenAIConfig() || texts.length === 0) {
    return texts.map(() => null);
  }

  const openai = getClient();

  // Split into API-sized batches, then run every batch concurrently instead of
  // sequentially. For a multi-page document this turns N round trips into one.
  const batches: string[][] = [];
  for (let index = 0; index < texts.length; index += 96) {
    batches.push(texts.slice(index, index + 96));
  }

  const responses = await Promise.all(
    batches.map((batch) =>
      openai.embeddings.create({
        model: appConfig.embeddingModel,
        input: batch
      })
    )
  );

  return responses.flatMap((response) => response.data.map((item) => item.embedding));
}

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  if (!hasOpenAIConfig()) {
    throw new Error("Voice output needs OPENAI_API_KEY to be configured on the server.");
  }

  const openai = getClient();
  const response = await openai.audio.speech.create({
    model: appConfig.speechModel,
    voice: appConfig.speechVoice,
    input: text,
    response_format: "mp3"
  });
  return await response.arrayBuffer();
}

export async function transcribeAudio(file: File, language?: string): Promise<string> {
  if (!hasOpenAIConfig()) {
    throw new Error("Voice input needs OPENAI_API_KEY to be configured on the server.");
  }

  const openai = getClient();
  const response = await openai.audio.transcriptions.create({
    file,
    model: appConfig.transcribeModel,
    ...(language ? { language } : {})
  });
  return (response.text || "").trim();
}

export async function embedQuery(query: string): Promise<number[] | null> {
  if (!hasOpenAIConfig()) {
    return null;
  }

  const [embedding] = await embedTexts([query]);
  return embedding ?? null;
}

export async function* streamTutorAnswer(input: {
  document: DocumentRecord;
  message: string;
  language?: string;
  history: ChatMessage[];
  chunks: DocumentChunk[];
  reference: Reference | null;
}): AsyncGenerator<string> {
  if (!hasOpenAIConfig()) {
    yield* streamFallbackAnswer(input);
    return;
  }

  const openai = getClient();
  const context = input.chunks
    .map((chunk) => `[Page ${chunk.pageNumber}] ${chunk.text}`)
    .join("\n\n");

  const response = await (openai.responses.create as unknown as (body: Record<string, unknown>) => Promise<AsyncIterable<Record<string, unknown>>>)({
    model: appConfig.tutorModel,
    instructions: buildTutorInstructions(input.document.title, input.language),
    reasoning: { effort: TUTOR_GENERATION.reasoningEffort },
    max_output_tokens: TUTOR_GENERATION.maxOutputTokens,
    input: [
      ...input.history.slice(-TUTOR_GENERATION.historyWindow).map((message) => ({
        role: message.role,
        content: message.content
      })),
      {
        role: "user",
        content: buildTutorUserTurn(context, input.message)
      }
    ],
    stream: true
  });

  for await (const event of response) {
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      yield event.delta;
    }
  }
}

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: appConfig.openaiApiKey });
  }

  return client;
}

async function* streamFallbackAnswer(input: {
  chunks: DocumentChunk[];
  reference: Reference | null;
}): AsyncGenerator<string> {
  const answer = buildFallbackAnswer(input.reference, input.chunks[0]);

  for (let index = 0; index < answer.length; index += FALLBACK_STREAM_CHUNK) {
    yield answer.slice(index, index + FALLBACK_STREAM_CHUNK);
  }
}
