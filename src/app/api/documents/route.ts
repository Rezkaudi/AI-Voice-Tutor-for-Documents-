import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { chunkDocumentPages, titleFromFileName, validateUploadFile } from "@/lib/documents";
import { requireAccess } from "@/server/access-control";
import { getDocumentStore } from "@/server/document-store";
import { extractPagesFromUpload } from "@/server/extract-text";
import { embedTexts } from "@/server/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await requireAccess();
  if (denied) {
    return denied;
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload one PDF, text, or markdown file." }, { status: 400 });
  }

  const validation = validateUploadFile({
    name: file.name,
    type: file.type,
    size: file.size
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  try {
    const id = randomUUID();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const pages = (await extractPagesFromUpload(fileBuffer, validation.kind)).map((page) => ({
      ...page,
      id: randomUUID(),
      documentId: id
    }));
    const chunks = chunkDocumentPages(pages).map((chunk) => ({
      ...chunk,
      documentId: id
    }));

    if (!chunks.length) {
      return NextResponse.json({ error: "No searchable text was found in this file." }, { status: 422 });
    }

    // Save immediately with empty embeddings so the learner can start right
    // away. Chat retrieval falls back to keyword ranking until embeddings land.
    const store = getDocumentStore();
    const document = await store.saveProcessedDocument({
      id,
      title: titleFromFileName(file.name),
      fileName: file.name,
      mimeType: file.type || contentTypeFor(validation.kind),
      fileType: validation.kind,
      fileSize: file.size,
      fileBuffer,
      pages,
      chunks: chunks.map((chunk) => ({ ...chunk, embedding: null }))
    });

    // Compute embeddings after the response is sent so the upload no longer
    // blocks on multiple OpenAI round trips.
    after(async () => {
      try {
        const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));
        await store.updateChunkEmbeddings(
          id,
          chunks.map((chunk, index) => ({ id: chunk.id, embedding: embeddings[index] ?? null }))
        );
      } catch (embeddingError) {
        console.error("Background embedding failed for document", id, embeddingError);
      }
    });

    return NextResponse.json({
      documentId: document.id,
      status: document.status
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The document could not be processed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function contentTypeFor(kind: string): string {
  if (kind === "pdf") {
    return "application/pdf";
  }

  if (kind === "markdown") {
    return "text/markdown";
  }

  return "text/plain";
}
