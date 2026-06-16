import type { CookieOptions, Response } from "express";
import { ENV_CONFIG } from "@/config/env.config";
import type { AuthTokens } from "@/domain/services/token-service";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const OAUTH_STATE_COOKIE = "oauth_state";

const OAUTH_STATE_MAX_AGE_MS = 10 * 60_000;

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: ENV_CONFIG.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/"
  };
}

function durationMs(ttl: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(ttl.trim());
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  const perUnit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * perUnit[unit];
}

export function setAuthCookies(res: Response, tokens: AuthTokens): void {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseOptions(),
    maxAge: durationMs(ENV_CONFIG.ACCESS_TOKEN_TTL)
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    maxAge: durationMs(ENV_CONFIG.REFRESH_TOKEN_TTL)
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, baseOptions());
  res.clearCookie(REFRESH_TOKEN_COOKIE, baseOptions());
}

export function setStateCookie(res: Response, state: string): void {
  res.cookie(OAUTH_STATE_COOKIE, state, {
    ...baseOptions(),
    maxAge: OAUTH_STATE_MAX_AGE_MS
  });
}

export function clearStateCookie(res: Response): void {
  res.clearCookie(OAUTH_STATE_COOKIE, baseOptions());
}
