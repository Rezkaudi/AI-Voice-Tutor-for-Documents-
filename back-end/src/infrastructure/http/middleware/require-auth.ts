import type { NextFunction, Request, RequestHandler, Response } from "express";
import { UnauthorizedError } from "@/domain/errors/app-error";
import type { TokenService } from "@/domain/services/token-service";
import { ACCESS_TOKEN_COOKIE } from "@/config/cookies.config";

export interface RequestAuth {
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: RequestAuth;
    }
  }
}

export function buildRequireAuth(tokenService: TokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;
    if (!token) {
      throw new UnauthorizedError();
    }

    try {
      const { userId } = tokenService.verifyAccessToken(token);
      req.auth = { userId };
      next();
    } catch {
      throw new UnauthorizedError("Your session has expired.");
    }
  };
}
