import jwt, { type SignOptions } from "jsonwebtoken";
import type { EnvConfig } from "@/config/env.config";
import type { TokenPayload, TokenService } from "@/domain/services/token-service";

export class JwtTokenService implements TokenService {
  constructor(private readonly env: EnvConfig) { }

  signAccessToken(payload: TokenPayload): string {
    return this.sign(payload, this.env.JWT_ACCESS_SECRET, this.env.ACCESS_TOKEN_TTL);
  }

  signRefreshToken(payload: TokenPayload): string {
    return this.sign(payload, this.env.JWT_REFRESH_SECRET, this.env.REFRESH_TOKEN_TTL);
  }

  verifyAccessToken(token: string): TokenPayload {
    return this.verify(token, this.env.JWT_ACCESS_SECRET);
  }

  verifyRefreshToken(token: string): TokenPayload {
    return this.verify(token, this.env.JWT_REFRESH_SECRET);
  }

  private sign(payload: TokenPayload, secret: string, expiresIn: string): string {
    const options = { expiresIn } as SignOptions;
    return jwt.sign({ userId: payload.userId }, secret, options);
  }

  private verify(token: string, secret: string): TokenPayload {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === "string" || typeof decoded.userId !== "string") {
      throw new Error("Malformed token payload.");
    }
    return { userId: decoded.userId };
  }
}
