import type { Reference } from "@/domain/entities/chat";
import type { TutorReplyRequest } from "@/domain/services/tutor-service";
import type { Logger } from "@/domain/services/logger";
import type { DocumentReferenceFactory } from "@/domain/logic/citation/document-reference-factory";

export interface ToolResult {
  output: string;
  references: Reference[];
}

export class TutorToolExecutor {
  constructor(private readonly referenceFactory: DocumentReferenceFactory) { }

  async execute(
    name: string,
    rawArgs: string,
    request: TutorReplyRequest,
    log: Logger
  ): Promise<ToolResult> {
    const args = this.parseArgs(rawArgs);
    switch (name) {
      case "get_page":
        return this.getPage(Number(args.page), request, log);
      default:
        log.warn(`unknown tool requested: ${name}`);
        return { output: `Unknown tool: ${name}`, references: [] };
    }
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
    const reference = this.referenceFactory.forPage(page.pageNumber, request.pages);
    log.info(
      `get_page ${pageNumber} → ${page.text.length} char(s)` +
      (reference ? " · 1 reference" : " · no reference")
    );
    return {
      output: `[Page ${page.pageNumber}]\n${page.text}`,
      references: reference ? [reference] : []
    };
  }

  private parseArgs(rawArgs: string): Record<string, unknown> {
    try {
      return JSON.parse(rawArgs || "{}");
    } catch {
      return {};
    }
  }
}
