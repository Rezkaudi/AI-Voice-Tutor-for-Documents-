export type PaymentTransactionStatus = "pending" | "completed" | "failed";

export interface PaymentTransaction {
  id: string;
  userId: string;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  packageName: string;
  creditsPurchased: number;
  amountPaid: number;
  currency: string;
  status: PaymentTransactionStatus;
  createdAt: string;
  completedAt: string | null;
}
