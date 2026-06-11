import { type AuthenticatedUserDto, toAuthenticatedUserDto } from "@/application/dto/auth-dto";
import { UnauthorizedError } from "@/domain/errors/app-error";
import type { UserRepository } from "@/domain/repositories/user-repository";

export class GetCurrentUserUseCase {
  constructor(private readonly userRepository: UserRepository) { }

  async execute(userId: string): Promise<AuthenticatedUserDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("Your session is no longer valid.");
    }
    return toAuthenticatedUserDto(user);
  }
}
