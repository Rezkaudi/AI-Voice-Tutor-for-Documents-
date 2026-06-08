import { type AuthResultDto, toAuthenticatedUserDto } from "@/application/dto/auth-dto";
import { UnauthorizedError } from "@/domain/errors/app-error";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { TokenService } from "@/domain/services/token-service";

export class RefreshSessionUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService
  ) { }

  async execute(refreshToken: unknown): Promise<AuthResultDto> {
    if (typeof refreshToken !== "string" || refreshToken.length === 0) {
      throw new UnauthorizedError("No active session.");
    }

    let payload;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError("Your session has expired. Please sign in again.");
    }

    const user = await this.userRepository.findById(payload.userId);
    if (!user) {
      throw new UnauthorizedError("Your session is no longer valid.");
    }

    const nextPayload = { userId: user.id };
    return {
      user: toAuthenticatedUserDto(user),
      tokens: {
        accessToken: this.tokenService.signAccessToken(nextPayload),
        refreshToken: this.tokenService.signRefreshToken(nextPayload)
      }
    };
  }
}
