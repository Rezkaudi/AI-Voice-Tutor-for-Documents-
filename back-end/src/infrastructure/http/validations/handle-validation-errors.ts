import type { RequestHandler } from "express";
import { validationResult } from "express-validator";
import { ValidationError } from "@/domain/errors/app-error";

export const handleValidationErrors: RequestHandler = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) {
    next();
    return;
  }

  const [firstError] = result.array({ onlyFirstError: true });
  next(
    new ValidationError(String(firstError?.msg ?? "The request was invalid."))
  );
};
