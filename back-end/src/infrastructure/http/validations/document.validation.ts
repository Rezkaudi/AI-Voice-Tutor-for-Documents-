import type { Request, RequestHandler } from "express";
import { check, param } from "express-validator";
import { handleValidationErrors } from "./handle-validation-errors";

export const uploadDocumentValidation: RequestHandler[] = [
  check("file")
    .custom((_value, { req }) => Boolean((req as Request).file))
    .withMessage("Upload one PDF file."),
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
