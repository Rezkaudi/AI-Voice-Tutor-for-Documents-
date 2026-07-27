import type { Request, Response } from "express";

import type { DeleteDocumentUseCase } from "@/application/use-cases/documents/delete-document.use-case";
import type { GetDocumentUseCase } from "@/application/use-cases/documents/get-document.use-case";
import type { ListDocumentsUseCase } from "@/application/use-cases/documents/list-documents.use-case";
import type { CreateUploadUrlUseCase } from "@/application/use-cases/documents/create-upload-url.use-case";
import type { RegisterUploadUseCase } from "@/application/use-cases/documents/register-upload.use-case";
import type { EndLessonSessionUseCase } from "@/application/use-cases/documents/end-lesson-session.use-case";
import type { PrepareLessonPagesUseCase } from "@/application/use-cases/documents/prepare-lesson-pages.use-case";
import type { ExtractDocumentPagesUseCase } from "@/application/use-cases/documents/extract-document-pages.use-case";
import type { PageExtractionEvent } from "@/application/dto/page-extraction-event";

export class DocumentsController {
  constructor(
    private readonly createUploadUrl: CreateUploadUrlUseCase,
    private readonly registerUpload: RegisterUploadUseCase,
    private readonly getDocument: GetDocumentUseCase,
    private readonly listDocuments: ListDocumentsUseCase,
    private readonly deleteDocument: DeleteDocumentUseCase,
    private readonly endLessonSession: EndLessonSessionUseCase,
    private readonly prepareLessonPages: PrepareLessonPagesUseCase,
    private readonly extractDocumentPages: ExtractDocumentPagesUseCase
  ) { }

  /** POST /api/documents/session/end — releases the user's cached lesson pages. */
  endSession = async (req: Request, res: Response): Promise<void> => {
    await this.endLessonSession.execute(req.auth!.userId);
    res.status(204).end();
  };

  /** GET /api/documents/:id/pages/extract-stream — SSE stream that drives*/
  extractStream = async (req: Request, res: Response): Promise<void> => {
    const controller = new AbortController();
    req.on("close", () => controller.abort());

    const events = await this.extractDocumentPages.execute(
      { userId: req.auth!.userId, documentId: String(req.params.id) },
      controller.signal
    );

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    for await (const event of events) {
      if (controller.signal.aborted) {
        break;
      }
      res.write(serializeEvent(event));
    }
    res.end();
  };

  preparePages = async (req: Request, res: Response): Promise<void> => {
    const result = await this.prepareLessonPages.execute({
      userId: req.auth!.userId,
      documentId: String(req.params.id),
      pageNumbers: (req.body.pageNumbers ?? []) as number[]
    });
    res.json(result);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    res.json({ documents: await this.listDocuments.execute(req.auth!.userId) });
  };

  /** DELETE /api/documents/:id — removes the document and its file. */
  remove = async (req: Request, res: Response): Promise<void> => {
    await this.deleteDocument.execute(req.params.id, req.auth!.userId);
    res.status(204).end();
  };

  /**
   * POST /api/documents/upload-url — validates a would-be upload and returns a
   * presigned URL the browser PUTs the file to directly (no bytes touch us).
   */
  uploadUrl = async (req: Request, res: Response): Promise<void> => {
    const result = await this.createUploadUrl.execute({
      userId: req.auth!.userId,
      filename: String(req.body.filename),
      mimeType: String(req.body.mimeType || "application/pdf"),
      size: Number(req.body.size)
    });
    res.json({ documentId: result.documentId, url: result.url, contentType: result.contentType });
  };

  register = async (req: Request, res: Response): Promise<void> => {
    const result = await this.registerUpload.execute({
      userId: req.auth!.userId,
      documentId: String(req.body.documentId),
      filename: String(req.body.filename),
      mimeType: String(req.body.mimeType || "application/pdf"),
      pageCount: Number(req.body.pageCount)
    });
    res.json(result);
  };

  /** GET /api/documents/:id — returns the processed document. */
  get = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.getDocument.execute(req.params.id, req.auth!.userId));
  };
}

function serializeEvent(event: PageExtractionEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
