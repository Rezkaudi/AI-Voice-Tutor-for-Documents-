import type { GoogleProfile } from "@/domain/entities/user";

export interface OAuthProvider {
  getAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<GoogleProfile>;
}
