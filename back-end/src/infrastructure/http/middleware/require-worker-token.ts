import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { UnauthorizedError } from "@/domain/errors/app-error";

export const WORKER_TOKEN_HEADER = "x-extraction-token";

export function buildRequireWorkerToken(expected: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!expected) {
      throw new UnauthorizedError("The extraction worker endpoint is not configured.");
    }

    const provided = req.header(WORKER_TOKEN_HEADER) ?? "";
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedError();
    }
    next();
  };
}
