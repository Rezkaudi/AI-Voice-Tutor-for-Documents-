import type { Request, RequestHandler } from "express";
import { check, param } from "express-validator";
import { handleValidationErrors } from "./handle-validation-errors";

export const uploadDocumentValidation: RequestHandler[] = [
  check("file")
    .custom((_value, { req }) => Boolean((req as Request).file))
    .withMessage("Upload one PDF file."),
  handleValidationErrors
];

export const uploadUrlValidation: RequestHandler[] = [
  check("filename").isString().bail().trim().notEmpty().withMessage("A filename is required."),
  check("size").isInt({ min: 1 }).withMessage("A file size is required."),
  handleValidationErrors
];

export const registerUploadValidation: RequestHandler[] = [
  check("documentId").isString().bail().trim().notEmpty().withMessage("A documentId is required."),
  check("filename").isString().bail().trim().notEmpty().withMessage("A filename is required."),
  check("pageCount").isInt({ min: 1 }).withMessage("A page count is required."),
  handleValidationErrors
];

export const documentIdParamValidation: RequestHandler[] = [
  param("id")
    .isString()
    .withMessage("A document id is required.")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("A document id is required."),
  handleValidationErrors
];
