import type { PaymentTransaction } from "@/domain/entities/payment-transaction";

export interface PaymentTransactionRepository {
  findByStripeSessionId(stripeSessionId: string): Promise<PaymentTransaction | null>;
  save(transaction: PaymentTransaction): Promise<PaymentTransaction>;
  markCompleted(id: string, stripePaymentIntentId: string | null, completedAt: string): Promise<void>;
  markFailed(id: string): Promise<void>;
}
