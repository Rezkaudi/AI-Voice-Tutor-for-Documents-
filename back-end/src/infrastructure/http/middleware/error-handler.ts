import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { AppError } from "@/domain/errors/app-error";
import { logger } from "@/shared/logger";

export function errorHandler() {
  return (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (res.headersSent) {
      res.end();
      return;
    }

    if (error instanceof MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge
          ? "The upload is too large."
          : `Upload error: ${error.message}`
      });
      return;
    }

    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        logger.error(`${req.method} ${req.path} → ${error.code}`, error);
      }
      res.status(error.statusCode).json({
        error: error.expose ? error.message : "Something went wrong."
      });
      return;
    }

    logger.error(`Unhandled error on ${req.method} ${req.path}`, error);
    res.status(500).json({ error: "An unexpected error occurred." });
  };
}

export function notFoundHandler() {
  return (_req: Request, res: Response): void => {
    res.status(404).json({ error: "Not found." });
  };
}
