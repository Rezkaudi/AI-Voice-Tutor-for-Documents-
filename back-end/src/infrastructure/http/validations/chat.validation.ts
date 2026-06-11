import type { RequestHandler } from "express";
import { body } from "express-validator";
import { MAX_LESSON_PAGES } from "@/config/constant.config";
import { handleValidationErrors } from "./handle-validation-errors";

export const streamChatValidation: RequestHandler[] = [
  body("documentId")
    .isString()
    .withMessage("A documentId is required.")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("A documentId is required."),
  body("message")
    .isString()
    .withMessage("A message is required.")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("A message is required."),
  body("language")
    .customSanitizer((value) => (value === undefined ? "" : value))
    .isString()
    .withMessage("Language must be text.")
    .trim(),
  body("messages")
    .customSanitizer((value) => (value === undefined ? [] : value))
    .isArray()
    .withMessage("Messages must be an array."),
  body("messages.*.role")
    .isIn(["user", "assistant"])
    .withMessage("Message roles must be user or assistant."),
  body("messages.*.content")
    .isString()
    .withMessage("Message content must be text."),
  body("selectedPages")
    .customSanitizer((value) => (value === undefined ? [] : value))
    .isArray({ max: MAX_LESSON_PAGES })
    .withMessage(`Pick at most ${MAX_LESSON_PAGES} pages.`),
  body("selectedPages.*")
    .isInt({ min: 1 })
    .withMessage("Page numbers must be positive integers.")
    .toInt(),
  body("saveCost")
    .customSanitizer((value) => (value === undefined ? false : value))
    .isBoolean()
    .withMessage("saveCost must be a boolean.")
    .toBoolean(),
  handleValidationErrors
];
