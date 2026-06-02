import type { Reference } from "@/domain/entities/chat";
import type { EmbeddingService } from "@/domain/services/embedding-service";
import type { ChunkRanker } from "@/domain/logic/chunk-ranker";
import type { TutorReplyRequest } from "@/domain/services/tutor-service";
import type { DocumentReferenceFactory } from "@/domain/logic/citation/document-reference-factory";

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
    request: TutorReplyRequest
  ): Promise<ToolResult> {
    const args = this.parseArgs(rawArgs);
    switch (name) {
      case "get_outline":
        return this.getOutline(request);
      case "get_page":
        return this.getPage(Number(args.page), request);
      case "search_document":
        return this.searchDocument(args.query, request);
      default:
        return { output: `Unknown tool: ${name}`, references: [] };
    }
  }

  private getOutline(request: TutorReplyRequest): ToolResult {
    const outline = request.pages
      .map((page) => `Page ${page.pageNumber}: ${this.previewLine(page.text)}`)
      .join("\n");
    return {
      output: outline || "The document has no readable pages.",
      references: []
    };
  }

  private getPage(pageNumber: number, request: TutorReplyRequest): ToolResult {
    const page = request.pages.find((item) => item.pageNumber === pageNumber);
    if (!page) {
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
    return {
      output: `[Page ${page.pageNumber}]\n${page.text}`,
      references: reference ? [reference] : []
    };
  }

  private async searchDocument(
    rawQuery: unknown,
    request: TutorReplyRequest
  ): Promise<ToolResult> {
    const query =
      typeof rawQuery === "string" && rawQuery.trim() ? rawQuery : request.message;
    const embedding = await this.embeddings.embedQuery(query).catch(() => null);
    const ranked = this.ranker
      .rank(query, request.chunks, embedding)
      .slice(0, TutorToolExecutor.SEARCH_LIMIT);
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
