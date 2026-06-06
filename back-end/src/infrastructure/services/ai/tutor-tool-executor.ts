import type { Reference } from "@/domain/entities/chat";
import type { EmbeddingService } from "@/domain/services/embedding-service";
import type { ChunkRanker } from "@/domain/logic/chunk-ranker";
import type { TutorReplyRequest } from "@/domain/services/tutor-service";
import type { Logger } from "@/domain/services/logger";
import type { DocumentReferenceFactory } from "@/domain/logic/citation/document-reference-factory";
import { truncate } from "@/shared/logger";

/** Text returned to the model plus the page candidates surfaced this call. */
export interface ToolResult {
  output: string;
  references: Reference[];
}

/**
 * Runs the document-reading tools the tutor calls agentically: `get_outline`,
 * `get_page`, and `search_document`. Each returns text for the model and the
 * page references the UI may later highlight. `cite_passages` is handled by the
 * service itself, not here.
 */
export class TutorToolExecutor {
  private static readonly SEARCH_LIMIT = 10;

  constructor(
    private readonly embeddings: EmbeddingService,
    private readonly ranker: ChunkRanker,
    private readonly referenceFactory: DocumentReferenceFactory
  ) {}

  async execute(
    name: string,
    rawArgs: string,
    request: TutorReplyRequest,
    log: Logger
  ): Promise<ToolResult> {
    const args = this.parseArgs(rawArgs);
    switch (name) {
      case "get_outline":
        return this.getOutline(request, log);
      case "get_page":
        return this.getPage(Number(args.page), request, log);
      case "search_document":
        return this.searchDocument(args.query, request, log);
      default:
        log.warn(`unknown tool requested: ${name}`);
        return { output: `Unknown tool: ${name}`, references: [] };
    }
  }

  private getOutline(request: TutorReplyRequest, log: Logger): ToolResult {
    const outline = request.pages
      .map((page) => `Page ${page.pageNumber}: ${this.previewLine(page.text)}`)
      .join("\n");
    log.info(`get_outline → ${request.pages.length} page(s) summarised`);
    return {
      output: outline || "The document has no readable pages.",
      references: []
    };
  }

  private getPage(
    pageNumber: number,
    request: TutorReplyRequest,
    log: Logger
  ): ToolResult {
    const page = request.pages.find((item) => item.pageNumber === pageNumber);
    if (!page) {
      log.warn(
        `get_page ${pageNumber} → no such page (document has ${request.pages.length})`
      );
      return {
        output: `There is no page ${pageNumber}. The document has ${request.pages.length} page(s).`,
        references: []
      };
    }
    const reference = this.referenceFactory.forPage(
      page.pageNumber,
      request.pages,
      request.chunks
    );
    log.info(
      `get_page ${pageNumber} → ${page.text.length} char(s)` +
        (reference ? " · 1 reference" : " · no reference")
    );
    return {
      output: `[Page ${page.pageNumber}]\n${page.text}`,
      references: reference ? [reference] : []
    };
  }

  private async searchDocument(
    rawQuery: unknown,
    request: TutorReplyRequest,
    log: Logger
  ): Promise<ToolResult> {
    const usedFallback = !(typeof rawQuery === "string" && rawQuery.trim());
    const query = usedFallback ? request.message : (rawQuery as string);
    log.info(
      `search_document query="${truncate(query, 80)}"` +
        (usedFallback ? " (fell back to student message)" : "")
    );

    // Embedding is best-effort: a failure degrades to keyword-only ranking
    // rather than failing the search — but it must not pass silently.
    let embedding: number[] | null = null;
    try {
      embedding = await this.embeddings.embedQuery(query);
    } catch (error) {
      log.warn(
        `search_document embedding failed — keyword-only ranking (${describe(error)})`
      );
    }

    const ranked = this.ranker
      .rank(query, request.chunks, embedding)
      .slice(0, TutorToolExecutor.SEARCH_LIMIT);
    log.info(
      `search_document ranked ${request.chunks.length} chunk(s) · ` +
        `mode=${embedding ? "hybrid keyword+vector" : "keyword-only"} → ` +
        `${ranked.length} hit(s)`
    );
    if (!ranked.length) {
      return { output: "No matching passages were found in the document.", references: [] };
    }

    const output = ranked
      .map((item) => `[Page ${item.chunk.pageNumber}] ${item.chunk.text}`)
      .join("\n\n");

    const references: Reference[] = [];
    const seenPages = new Set<number>();
    for (const item of ranked) {
      if (seenPages.has(item.chunk.pageNumber)) {
        continue;
      }
      seenPages.add(item.chunk.pageNumber);
      references.push({
        pageNumber: item.chunk.pageNumber,
        chunkId: item.chunk.id,
        citations: []
      });
    }
    const top = ranked[0]!;
    log.info(
      `search_document → top page ${top.chunk.pageNumber} (score ${top.score.toFixed(2)}) · ` +
        `pages [${references.map((reference) => reference.pageNumber).join(", ")}]`
    );
    return { output, references };
  }

  private parseArgs(rawArgs: string): Record<string, unknown> {
    try {
      return JSON.parse(rawArgs || "{}");
    } catch {
      return {};
    }
  }

  /**
   * Outline preview: the first non-empty line (often the heading) plus a short
   * body snippet, so the tutor can tell sections apart.
   */
  private previewLine(text: string): string {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      return "(empty page)";
    }
    const heading = lines[0]!;
    const body = lines.slice(1).join(" ").replace(/\s+/g, " ").trim();
    const headingPart = heading.length > 120 ? `${heading.slice(0, 120)}...` : heading;
    if (!body) {
      return headingPart;
    }
    const bodyBudget = Math.max(40, 240 - headingPart.length);
    const bodyPart = body.length > bodyBudget ? `${body.slice(0, bodyBudget)}...` : body;
    return `${headingPart} — ${bodyPart}`;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
