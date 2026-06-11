import type { Request, Response } from "express";
import type { DeleteDocumentUseCase } from "@/application/use-cases/documents/delete-document.use-case";
import type { GetDocumentUseCase } from "@/application/use-cases/documents/get-document.use-case";
import type { GetDocumentFileUseCase } from "@/application/use-cases/documents/get-document-file.use-case";
import type { ListDocumentsUseCase } from "@/application/use-cases/documents/list-documents.use-case";
import type { UploadDocumentUseCase } from "@/application/use-cases/documents/upload-document.use-case";

/** HTTP adapter for document upload, retrieval, and file proxy. */
export class DocumentsController {
  constructor(
    private readonly uploadDocument: UploadDocumentUseCase,
    private readonly getDocument: GetDocumentUseCase,
    private readonly getDocumentFile: GetDocumentFileUseCase,
    private readonly listDocuments: ListDocumentsUseCase,
    private readonly deleteDocument: DeleteDocumentUseCase
  ) {}

  /** GET /api/documents — returns the signed-in user's processed documents. */
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

  /** GET /api/documents/:id — returns the processed document. */
  get = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.getDocument.execute(req.params.id, req.auth!.userId));
  };

  /** GET /api/documents/:id/file — streams the original uploaded file. */
  file = async (req: Request, res: Response): Promise<void> => {
    const result = await this.getDocumentFile.execute(req.params.id, req.auth!.userId);
    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${sanitizeHeaderFileName(result.fileName)}"`
    );
    res.setHeader("Content-Length", result.body.length);
    res.send(result.body);
  };
}

/** Drops control chars, quotes, and backslashes so a filename cannot break the header. */
function sanitizeHeaderFileName(fileName: string): string {
  const stripped = Array.from(fileName)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code > 0x1f && char !== '"' && char !== "\\";
    })
    .join("");
  return stripped.trim() || "document";
}
