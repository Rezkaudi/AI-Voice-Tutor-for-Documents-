import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "@/infrastructure/http/middleware/async-handler";
import type { DocumentsController } from "@/infrastructure/http/controllers/documents.controller";
import {
  documentIdParamValidation,
  uploadDocumentValidation
} from "@/infrastructure/http/validations/document.validation";

const DOCUMENT_LIMIT_BYTES = 25 * 1024 * 1024;

export function buildDocumentRoutes(controller: DocumentsController): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: DOCUMENT_LIMIT_BYTES }
  });

  router.post(
    "/documents",
    upload.single("file"),
    uploadDocumentValidation,
    asyncHandler(controller.upload)
  );
  router.get(
    "/documents/:id",
    documentIdParamValidation,
    asyncHandler(controller.get)
  );
  router.get(
    "/documents/:id/file",
    documentIdParamValidation,
    asyncHandler(controller.file)
  );

  return router;
}
