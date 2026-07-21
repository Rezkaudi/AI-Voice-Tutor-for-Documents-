import { type AuthResultDto, toAuthenticatedUserDto } from "@/application/dto/auth-dto";
import { UnauthorizedError } from "@/domain/errors/app-error";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { ContactSync } from "@/domain/services/contact-sync";
import type { OAuthProvider } from "@/domain/services/oauth-provider";
import type { TokenService } from "@/domain/services/token-service";

export class AuthenticateWithGoogleUseCase {
  constructor(
    private readonly oauthProvider: OAuthProvider,
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
    private readonly contactSync: ContactSync
  ) { }

  async execute(code: unknown): Promise<AuthResultDto> {
    if (typeof code !== "string" || code.trim().length === 0) {
      throw new UnauthorizedError("Missing authorization code.");
    }

    let profile;
    try {
      profile = await this.oauthProvider.exchangeCode(code);
    } catch {
      throw new UnauthorizedError("Google sign-in could not be completed.");
    }

    const { user, created } = await this.userRepository.upsertFromGoogle(profile);

    if (created) {
      void this.contactSync.syncUser(user);
    }

    const payload = { userId: user.id };

    return {
      user: toAuthenticatedUserDto(user),
      tokens: {
        accessToken: this.tokenService.signAccessToken(payload),
        refreshToken: this.tokenService.signRefreshToken(payload)
      }
    };
  }
}
