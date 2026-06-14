import type { NextFunction, Request, Response, RequestHandler } from "express";

import { PaymentRequiredError, UnauthorizedError } from "@/domain/errors/app-error";
import type { ICreditService } from "@/domain/services/credit-service";

export function buildRequireCredits(creditService: ICreditService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    void (async () => {
      try {
        if (!req.auth) {
          throw new UnauthorizedError();
        }
        const result = await creditService.hasEnoughCredits(req.auth.userId);
        if (!result.allowed) {
          throw new PaymentRequiredError(result.reason ?? "insufficient_credits");
        }
        next();
      } catch (error) {
        next(error);
      }
    })();
  };
}
