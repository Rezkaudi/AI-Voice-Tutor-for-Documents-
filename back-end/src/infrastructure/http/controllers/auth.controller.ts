import type { Request, Response } from "express";
import { ENV_CONFIG } from "@/config/env.config";
import { UnauthorizedError } from "@/domain/errors/app-error";
import type { AuthenticateWithGoogleUseCase } from "@/application/use-cases/auth/authenticate-with-google.use-case";
import type { GetCurrentUserUseCase } from "@/application/use-cases/auth/get-current-user.use-case";
import type { GetGoogleAuthUrlUseCase } from "@/application/use-cases/auth/get-google-auth-url.use-case";
import type { RefreshSessionUseCase } from "@/application/use-cases/auth/refresh-session.use-case";
import { OAUTH_STATE_COOKIE, REFRESH_TOKEN_COOKIE, clearAuthCookies, clearStateCookie, setAuthCookies, setStateCookie } from "@/config/cookies.config";
import { logger } from "@/shared/logger";

export class AuthController {
  constructor(
    private readonly getGoogleAuthUrl: GetGoogleAuthUrlUseCase,
    private readonly authenticateWithGoogle: AuthenticateWithGoogleUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase
  ) { }

  start = (_req: Request, res: Response): void => {
    const { url, state } = this.getGoogleAuthUrl.execute();
    setStateCookie(res, state);
    res.redirect(url);
  };

  callback = async (req: Request, res: Response): Promise<void> => {
    const { code, state, error } = req.query;
    const expectedState = req.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;
    clearStateCookie(res);

    if (error || !state || !expectedState || state !== expectedState) {
      const reason = error
        ? `consent denied (${String(error)})`
        : !expectedState
          ? "no oauth_state cookie on callback (browser dropped it — check Secure/SameSite/cookie blocking)"
          : !state
            ? "no state in query"
            : "state value mismatch";
      logger.warn(`Rejected Google callback: ${reason}.`);
      res.redirect(`${ENV_CONFIG.FRONTEND_URL}/?auth=error`);
      return;
    }

    try {
      const { tokens } = await this.authenticateWithGoogle.execute(code);
      setAuthCookies(res, tokens);
      res.redirect(ENV_CONFIG.FRONTEND_URL);
    } catch (err) {
      logger.warn("Google sign-in failed during code exchange.", err);
      res.redirect(`${ENV_CONFIG.FRONTEND_URL}/?auth=error`);
    }
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    try {
      const { user, tokens } = await this.refreshSession.execute(refreshToken);
      setAuthCookies(res, tokens);
      res.json({ user });
    } catch (err) {
      clearAuthCookies(res);
      throw err;
    }
  };

  me = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) {
      throw new UnauthorizedError();
    }
    res.json({ user: await this.getCurrentUser.execute(req.auth.userId) });
  };

  logout = (_req: Request, res: Response): void => {
    clearAuthCookies(res);
    res.status(204).end();
  };
}
