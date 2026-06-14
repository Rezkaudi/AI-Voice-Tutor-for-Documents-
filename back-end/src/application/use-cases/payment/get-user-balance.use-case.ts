import type { BalanceDto } from "@/application/dto/billing-dto";
import { NotFoundError } from "@/domain/errors/app-error";
import type { UserRepository } from "@/domain/repositories/user-repository";

export class GetUserBalanceUseCase {
  constructor(private readonly userRepository: UserRepository) { }

  async execute(userId: string): Promise<BalanceDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found.");
    }
    return {
      creditBalance: user.subscriptionCredits + user.topupCredits,
      subscriptionCredits: user.subscriptionCredits,
      topupCredits: user.topupCredits,
      hasPurchased: user.hasPurchased
    };
  }
}
