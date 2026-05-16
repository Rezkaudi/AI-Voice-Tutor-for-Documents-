import { NextResponse } from "next/server";
import { buildReferenceSnippet, rankChunks } from "@/lib/retrieval";
import type { ChatMessage, Reference } from "@/lib/types";
import { requireAccess } from "@/server/access-control";
import { getDocumentStore } from "@/server/document-store";
import { embedQuery, streamTutorAnswer } from "@/server/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await requireAccess();
  if (denied) {
    return denied;
  }

  const body = await request.json().catch(() => null);
  const documentId = typeof body?.documentId === "string" ? body.documentId : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const language = typeof body?.language === "string" ? body.language.trim() : "";
  const history = Array.isArray(body?.messages) ? sanitizeMessages(body.messages) : [];

  if (!documentId || !message) {
    return NextResponse.json({ error: "Document and message are required." }, { status: 400 });
  }

  const store = getDocumentStore();
  const document = await store.getDocument(documentId);
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const chunks = await store.getChunks(documentId);
  const queryEmbedding = await embedQuery(message).catch(() => null);
  const ranked = rankChunks(message, chunks, queryEmbedding).slice(0, 5);
  const selectedChunks = ranked.map((item) => item.chunk);
  const reference: Reference | null = selectedChunks[0]
    ? {
        pageNumber: selectedChunks[0].pageNumber,
        snippet: buildReferenceSnippet(selectedChunks[0].text, message),
        chunkId: selectedChunks[0].id
      }
    : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      writeEvent(controller, encoder, "meta", { reference });

      try {
        for await (const delta of streamTutorAnswer({
          document,
          message,
          language,
          history,
          chunks: selectedChunks,
          reference
        })) {
          writeEvent(controller, encoder, "delta", { text: delta });
        }

        writeEvent(controller, encoder, "done", {});
      } catch (error) {
        const message = error instanceof Error ? error.message : "The teacher could not answer right now.";
        writeEvent(controller, encoder, "error", { error: message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  });
}

function writeEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: string,
  data: unknown
): void {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

function sanitizeMessages(messages: unknown[]): ChatMessage[] {
  return messages
    .filter((message): message is ChatMessage => {
      if (!message || typeof message !== "object") {
        return false;
      }

      const candidate = message as Record<string, unknown>;
      return (
        (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.content === "string" &&
        candidate.content.trim().length > 0
      );
    })
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4000)
    }));
}
