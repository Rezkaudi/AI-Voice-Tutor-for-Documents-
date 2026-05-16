import OpenAI from "openai";
import { appConfig, hasOpenAIConfig } from "@/lib/config";
import type { ChatMessage, DocumentChunk, DocumentRecord, Reference } from "@/lib/types";

let client: OpenAI | null = null;

export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  if (!hasOpenAIConfig() || texts.length === 0) {
    return texts.map(() => null);
  }

  const openai = getClient();
  const embeddings: (number[] | null)[] = [];

  for (let index = 0; index < texts.length; index += 96) {
    const batch = texts.slice(index, index + 96);
    const response = await openai.embeddings.create({
      model: appConfig.embeddingModel,
      input: batch
    });

    embeddings.push(...response.data.map((item) => item.embedding));
  }

  return embeddings;
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
    instructions: tutorInstructions(input.document.title, input.language),
    input: [
      ...input.history.slice(-8).map((message) => ({
        role: message.role,
        content: message.content
      })),
      {
        role: "user",
        content: `Document context:\n${context}\n\nStudent request:\n${input.message}`
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

const LANGUAGE_NAMES: Record<string, string> = {
  ja: "Japanese",
  en: "English",
  ar: "Arabic"
};

function tutorInstructions(title: string, language?: string): string {
  const languageName = language ? LANGUAGE_NAMES[language] : undefined;
  const languageRule = languageName
    ? `Always respond entirely in ${languageName}, regardless of the language of the document or the student's message. Every reply, including check-in questions, must be in ${languageName}.`
    : "Respond in the same language the student writes or speaks in.";

  return [
    `You are a calm, engaging AI teacher helping a student learn "${title}".`,
    languageRule,
    "Teach only from the supplied document context. If the document does not contain the answer, say that clearly.",
    "Use short paragraphs, concrete examples, and one small check-in question when useful.",
    "When the student asks to continue, move to the next important idea from the context.",
    "Do not mention embeddings, chunks, retrieval, or internal tooling."
  ].join("\n");
}

async function* streamFallbackAnswer(input: {
  message: string;
  chunks: DocumentChunk[];
  reference: Reference | null;
}): AsyncGenerator<string> {
  const reference = input.reference;
  const firstChunk = input.chunks[0];
  const sourceText = reference?.snippet || firstChunk?.snippet || "I found the document, but I could not extract a useful passage yet.";
  const pageText = reference ? `On page ${reference.pageNumber}, ` : "";
  const answer = [
    "I can teach from this document in local demo mode.",
    `${pageText}the most relevant passage says: "${sourceText}"`,
    "A simple way to understand it is to identify the main claim, then connect each detail back to that claim.",
    "What part would you like me to slow down and explain next?"
  ].join("\n\n");

  for (let index = 0; index < answer.length; index += 36) {
    yield answer.slice(index, index + 36);
  }
}
