import { OAuth2Client } from "google-auth-library";
import type { EnvConfig } from "@/config/env.config";
import type { GoogleProfile } from "@/domain/entities/user";
import type { OAuthProvider } from "@/domain/services/oauth-provider";

const SCOPES = ["openid", "email", "profile"];

export class GoogleOAuthService implements OAuthProvider {
  private readonly client: OAuth2Client;

  constructor(private readonly env: EnvConfig) {
    this.client = new OAuth2Client({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_CALLBACK_URL
    });
  }

  getAuthorizationUrl(state: string): string {
    return this.client.generateAuthUrl({
      scope: SCOPES,
      state,
      prompt: "select_account"
    });
  }

  async exchangeCode(code: string): Promise<GoogleProfile> {
    const { tokens } = await this.client.getToken(code);
    if (!tokens.id_token) {
      throw new Error("Google did not return an ID token.");
    }

    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new Error("Google ID token was missing required claims.");
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      picture: payload.picture ?? null
    };
  }
}
