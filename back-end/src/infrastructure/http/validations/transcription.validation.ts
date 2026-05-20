import type { Request, RequestHandler } from "express";
import { body, check } from "express-validator";
import { handleValidationErrors } from "./handle-validation-errors";

export const transcribeValidation: RequestHandler[] = [
  check("audio")
    .custom((_value, { req }) => Boolean((req as Request).file))
    .withMessage("No audio file was received."),
  body("language")
    .customSanitizer((value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const language = value.trim().toLowerCase();
      return /^[a-z]{2}$/.test(language) ? language : undefined;
    })
    .optional(),
  handleValidationErrors
];
