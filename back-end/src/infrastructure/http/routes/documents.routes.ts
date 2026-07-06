import { Router } from "express";

import { asyncHandler } from "@/infrastructure/http/middleware/async-handler";
import { documentUpload } from "@/infrastructure/http/middleware/document-upload";
import type { DocumentsController } from "@/infrastructure/http/controllers/documents.controller";
import { documentIdParamValidation, registerUploadValidation, uploadDocumentValidation, uploadUrlValidation } from "@/infrastructure/http/validations/document.validation";

export function buildDocumentRoutes(controller: DocumentsController): Router {
  const router = Router();

  router.get("/documents", asyncHandler(controller.list));
  router.post("/documents/session/end", asyncHandler(controller.endSession));
  router.post(
    "/documents",
    documentUpload.single("file"),
    uploadDocumentValidation,
    asyncHandler(controller.upload)
  );
  router.post(
    "/documents/upload-url",
    uploadUrlValidation,
    asyncHandler(controller.uploadUrl)
  );
  router.post(
    "/documents/register",
    registerUploadValidation,
    asyncHandler(controller.register)
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
  router.delete(
    "/documents/:id",
    documentIdParamValidation,
    asyncHandler(controller.remove)
  );

  return router;
}
