import type { PaymentStatusDto } from "@/application/dto/billing-dto";
import { NotFoundError } from "@/domain/errors/app-error";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { PaymentTransactionRepository } from "@/domain/repositories/payment-transaction-repository";

export class PollPaymentStatusUseCase {
  constructor(
    private readonly paymentTransactionRepository: PaymentTransactionRepository,
    private readonly userRepository: UserRepository
  ) { }

  async execute(userId: string, sessionId: string): Promise<PaymentStatusDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found.");
    }

    const txn = await this.paymentTransactionRepository.findByStripeSessionId(sessionId);
    const status = txn && txn.userId === userId ? txn.status : "unknown";

    return {
      status,
      creditBalance: user.subscriptionCredits + user.topupCredits
    };
  }
}
