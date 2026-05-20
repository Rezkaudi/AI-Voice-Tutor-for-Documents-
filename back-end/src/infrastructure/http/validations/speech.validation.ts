import type { RequestHandler } from "express";
import { body } from "express-validator";
import { handleValidationErrors } from "./handle-validation-errors";

export const speakValidation: RequestHandler[] = [
  body("text")
    .isString()
    .withMessage("Text to speak is required.")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Text to speak is required."),
  handleValidationErrors
];
