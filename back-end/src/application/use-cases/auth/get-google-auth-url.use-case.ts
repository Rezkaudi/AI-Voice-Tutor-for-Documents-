import type { IdGenerator } from "@/domain/services/id-generator";
import type { OAuthProvider } from "@/domain/services/oauth-provider";

export interface GoogleAuthUrl {
  url: string;
  state: string;
}

export class GetGoogleAuthUrlUseCase {
  constructor(
    private readonly oauthProvider: OAuthProvider,
    private readonly idGenerator: IdGenerator
  ) {}

  execute(): GoogleAuthUrl {
    const state = this.idGenerator.uuid();
    return { url: this.oauthProvider.getAuthorizationUrl(state), state };
  }
}
