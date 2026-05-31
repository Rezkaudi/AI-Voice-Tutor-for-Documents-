/**
 * End-to-end citation/answer evaluation harness.
 *
 * Uses the real composition root: same repository, same chunks/embeddings, and
 * same tutor service the HTTP API uses. The script only adds CLI parsing and
 * pretty-printing — every production code path is exercised as-is.
 *
 * Run:
 *   npm run eval:citations -- --list
 *   npm run eval:citations -- --document-id <uuid> \
 *     --question "How do I dockerize a React app?"
 *
 * Multiple --question flags run sequentially. --all uses a built-in suite.
 */
import "reflect-metadata";

import { buildContainer } from "@/container";
import type { Citation, Reference } from "@/domain/entities/chat";
import type {
  DocumentChunk,
  DocumentPage,
  DocumentRecord
} from "@/domain/entities/document";
import type { TutorService } from "@/domain/services/tutor-service";
import type { DocumentRepository } from "@/domain/repositories/document-repository";

interface CliArgs {
  documentId: string | null;
  questions: string[];
  language: string;
  saveCost: boolean;
  list: boolean;
}

const DEFAULT_QUESTIONS = [
  "What is Docker, in one paragraph?",
  "How do I dockerize a React app according to this document?",
  "What is the difference between an image and a container?",
  "Give me the steps to write a Dockerfile for a Node.js app."
];

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    documentId: null,
    questions: [],
    language: "en",
    saveCost: false,
    list: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--document-id" && next) { args.documentId = next; i += 1; }
    else if (a === "--question" && next) { args.questions.push(next); i += 1; }
    else if (a === "--language" && next) { args.language = next; i += 1; }
    else if (a === "--save-cost") { args.saveCost = true; }
    else if (a === "--all") { args.questions.push(...DEFAULT_QUESTIONS); }
    else if (a === "--list") { args.list = true; }
  }
  if (args.questions.length === 0) {
    args.questions = [DEFAULT_QUESTIONS[1]!];
  }
  return args;
}

interface RunResult {
  question: string;
  answer: string;
  reference: Reference | null;
  durationMs: number;
}

async function runQuestion(
  tutor: TutorService,
  question: string,
  document: DocumentRecord,
  pages: DocumentPage[],
  chunks: DocumentChunk[],
  language: string,
  saveCost: boolean
): Promise<RunResult> {
  const controller = new AbortController();
  const start = Date.now();
  let answer = "";
  let reference: Reference | null = null;
  for await (const event of tutor.streamReply(
    {
      document,
      message: question,
      language,
      history: [],
      pages,
      chunks,
      saveCost
    },
    controller.signal
  )) {
    if (event.type === "delta") answer += event.text;
    else if (event.type === "reference") reference = event.reference;
  }
  return { question, answer, reference, durationMs: Date.now() - start };
}

function snippet(text: string, start: number, end: number, pad = 60): string {
  const a = Math.max(0, start - pad);
  const b = Math.min(text.length, end + pad);
  const prefix = a > 0 ? "…" : "";
  const suffix = b < text.length ? "…" : "";
  return (
    prefix +
    text.slice(a, start) +
    "«" +
    text.slice(start, end) +
    "»" +
    text.slice(end, b) +
    suffix
  ).replace(/\s+/g, " ");
}

function heuristicSelfCheck(
  answer: string,
  reference: Reference | null
): Record<string, string | number | boolean> {
  const markers = [...answer.matchAll(/\[\[(\d+)\]\]/g)].map((m) => Number(m[1]));
  const citations = reference?.citations ?? [];
  const allMarkersResolve = markers.every((n) => n >= 1 && n <= citations.length);
  return {
    answer_chars: answer.length,
    answer_words: answer.trim().split(/\s+/).filter(Boolean).length,
    inline_markers: markers.length,
    citations_attached: citations.length,
    all_markers_resolve: allMarkersResolve,
    page_referenced: reference?.pageNumber ?? -1
  };
}

function printResult(result: RunResult, pages: DocumentPage[]): void {
  const bar = "═".repeat(80);
  console.log("\n" + bar);
  console.log("QUESTION:", result.question);
  console.log(bar);
  console.log("\nANSWER (" + result.durationMs + "ms):\n");
  console.log(result.answer || "(no answer)");

  console.log("\n--- Citations ---");
  const ref = result.reference;
  if (!ref || ref.citations.length === 0) {
    console.log("  (no citations attached)");
    if (ref) console.log("  page referenced:", ref.pageNumber);
  } else {
    console.log(`  page referenced: ${ref.pageNumber}`);
    ref.citations.forEach((c: Citation, i) => {
      const page = pages.find((p) => p.pageNumber === c.pageNumber);
      const ctx = page ? snippet(page.text, c.start, c.end) : "(page missing)";
      console.log(`  [[${i + 1}]] page ${c.pageNumber} chars ${c.start}-${c.end}`);
      console.log(`        quote: "${c.quote.replace(/\s+/g, " ").slice(0, 200)}"`);
      console.log(`        ctx  : ${ctx.slice(0, 240)}`);
    });
  }

  console.log("\n--- Heuristics ---");
  console.log(heuristicSelfCheck(result.answer, ref));
}

async function listDocuments(repository: DocumentRepository): Promise<void> {
  const docs = await repository.listReady();
  if (docs.length === 0) {
    console.log("(no ready documents in database)");
    return;
  }
  console.log(`Ready documents (${docs.length}):\n`);
  for (const d of docs) {
    console.log(`  ${d.id}  pages=${d.pageCount}  ${d.title}`);
  }
}

async function loadFromRepository(
  repository: DocumentRepository,
  documentId: string
): Promise<{
  document: DocumentRecord;
  pages: DocumentPage[];
  chunks: DocumentChunk[];
}> {
  const document = await repository.findById(documentId);
  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }
  const [pages, chunks] = await Promise.all([
    repository.getPages(documentId),
    repository.getChunks(documentId)
  ]);
  return { document, pages, chunks };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const container = await buildContainer();
  // The container builds the data source the API uses. We instantiate the
  // repository against it directly (the container doesn't re-expose it).
  const { TypeOrmDocumentRepository } = await import(
    "@/infrastructure/database/repositories/typeorm-document.repository"
  );
  const repo: DocumentRepository = new TypeOrmDocumentRepository(
    container.dataSource
  );

  try {
    if (args.list) {
      await listDocuments(repo);
      return;
    }

    if (!args.documentId) {
      console.error(
        "Missing --document-id. Run with --list to see available documents."
      );
      process.exitCode = 1;
      return;
    }

    console.log(`[eval] loading document ${args.documentId} from database…`);
    const { document, pages, chunks } = await loadFromRepository(
      repo,
      args.documentId
    );
    const withEmbeddings = chunks.filter((c) => c.embedding).length;
    console.log(
      `[eval] title="${document.title}" pages=${pages.length} ` +
        `chunks=${chunks.length} embedded=${withEmbeddings}`
    );

    const { OpenAiEmbeddingService } = await import(
      "@/infrastructure/services/ai/openai-embedding.service"
    );
    const { OpenAiTutorService } = await import(
      "@/infrastructure/services/ai/openai-tutor.service"
    );
    const { TextTokenizer } = await import("@/domain/logic/text-tokenizer");
    const { ChunkRanker } = await import("@/domain/logic/chunk-ranker");
    const { CitationResolver } = await import(
      "@/domain/logic/citation-resolver"
    );
    const { ENV_CONFIG } = await import("@/config/env.config");
    const embeddings = new OpenAiEmbeddingService(ENV_CONFIG);
    const tokenizer = new TextTokenizer();
    const tutor: TutorService = new OpenAiTutorService(
      ENV_CONFIG,
      embeddings,
      new ChunkRanker(tokenizer),
      new CitationResolver(tokenizer)
    );

    const results: RunResult[] = [];
    for (const question of args.questions) {
      console.log(`\n[eval] asking: ${question}`);
      const result = await runQuestion(
        tutor,
        question,
        document,
        pages,
        chunks,
        args.language,
        args.saveCost
      );
      printResult(result, pages);
      results.push(result);
    }

    if (results.length > 1) {
      console.log("\n" + "═".repeat(80));
      console.log("SUMMARY");
      console.log("═".repeat(80));
      results.forEach((result, i) => {
        const cites = result.reference?.citations.length ?? 0;
        console.log(
          `${i + 1}. citations=${cites}  ${result.durationMs}ms  | ${result.question}`
        );
      });
    }
  } finally {
    await container.dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
