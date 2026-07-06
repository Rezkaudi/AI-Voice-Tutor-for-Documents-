import type { Request, Response } from "express";

import type { DeleteDocumentUseCase } from "@/application/use-cases/documents/delete-document.use-case";
import type { GetDocumentUseCase } from "@/application/use-cases/documents/get-document.use-case";
import type { GetDocumentFileUseCase } from "@/application/use-cases/documents/get-document-file.use-case";
import type { ListDocumentsUseCase } from "@/application/use-cases/documents/list-documents.use-case";
import type { UploadDocumentUseCase } from "@/application/use-cases/documents/upload-document.use-case";
import type { CreateUploadUrlUseCase } from "@/application/use-cases/documents/create-upload-url.use-case";
import type { RegisterUploadUseCase } from "@/application/use-cases/documents/register-upload.use-case";
import type { EndLessonSessionUseCase } from "@/application/use-cases/documents/end-lesson-session.use-case";

export class DocumentsController {
  constructor(
    private readonly uploadDocument: UploadDocumentUseCase,
    private readonly createUploadUrl: CreateUploadUrlUseCase,
    private readonly registerUpload: RegisterUploadUseCase,
    private readonly getDocument: GetDocumentUseCase,
    private readonly getDocumentFile: GetDocumentFileUseCase,
    private readonly listDocuments: ListDocumentsUseCase,
    private readonly deleteDocument: DeleteDocumentUseCase,
    private readonly endLessonSession: EndLessonSessionUseCase
  ) { }

  /** POST /api/documents/session/end — releases the user's cached lesson pages. */
  endSession = async (req: Request, res: Response): Promise<void> => {
    await this.endLessonSession.execute(req.auth!.userId);
    res.status(204).end();
  };

  list = async (req: Request, res: Response): Promise<void> => {
    res.json({ documents: await this.listDocuments.execute(req.auth!.userId) });
  };

  /** DELETE /api/documents/:id — removes the document and its file. */
  remove = async (req: Request, res: Response): Promise<void> => {
    await this.deleteDocument.execute(req.params.id, req.auth!.userId);
    res.status(204).end();
  };

  /** POST /api/documents — accepts a multipart `file` field. */
  upload = async (req: Request, res: Response): Promise<void> => {
    const file = req.file!;
    const result = await this.uploadDocument.execute({
      userId: req.auth!.userId,
      buffer: file.buffer,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    });
    res.json(result);
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

  /** GET /api/documents/:id/file — streams the original uploaded file. */
  file = async (req: Request, res: Response): Promise<void> => {
    const result = await this.getDocumentFile.execute(req.params.id, req.auth!.userId);
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", contentDisposition(result.fileName));
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    if (result.eTag) res.setHeader("ETag", result.eTag);
    if (typeof result.contentLength === "number") {
      res.setHeader("Content-Length", result.contentLength);
    }

    const source = result.body;
    res.on("close", () => {
      if (!source.destroyed) source.destroy();
    });
    source.on("error", (error: Error) => {
      if (!res.headersSent) {
        res.status(502).json({ message: "Failed to stream the document file." });
      } else {
        res.destroy(error);
      }
    });
    source.pipe(res);
  };
}

function contentDisposition(fileName: string): string {
  const name = String(fileName ?? "").slice(0, 200);
  const asciiFallback =
    Array.from(name)
      .map((char) => {
        const code = char.codePointAt(0) ?? 0;
        return code > 0x1f && code < 0x7f && char !== '"' && char !== "\\"
          ? char
          : "_";
      })
      .join("")
      .trim() || "document";
  const encoded = encodeURIComponent(name).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
