import type { DataSource } from "typeorm";
import type { PaymentTransaction } from "@/domain/entities/payment-transaction";
import type { PaymentTransactionRepository } from "@/domain/repositories/payment-transaction-repository";

import { PaymentTransactionOrmEntity } from "../entities/payment-transaction.entity";

export class TypeOrmPaymentTransactionRepository
  implements PaymentTransactionRepository {
  constructor(private readonly dataSource: DataSource) { }

  async findByStripeSessionId(stripeSessionId: string): Promise<PaymentTransaction | null> {

    const row = await this.dataSource
      .getRepository(PaymentTransactionOrmEntity)
      .findOne({ where: { stripeSessionId } });
    return row ? toTransaction(row) : null;
  }

  async save(transaction: PaymentTransaction): Promise<PaymentTransaction> {
    const repository = this.dataSource.getRepository(PaymentTransactionOrmEntity);
    const row = new PaymentTransactionOrmEntity();
    row.id = transaction.id;
    row.userId = transaction.userId;
    row.stripeSessionId = transaction.stripeSessionId;
    row.stripePaymentIntentId = transaction.stripePaymentIntentId;
    row.packageName = transaction.packageName;
    row.creditsPurchased = transaction.creditsPurchased;
    row.amountPaid = transaction.amountPaid;
    row.currency = transaction.currency;
    row.status = transaction.status;
    row.createdAt = new Date(transaction.createdAt);
    row.completedAt = transaction.completedAt ? new Date(transaction.completedAt) : null;

    const saved = await repository.save(row);
    return toTransaction(saved);
  }

  async markCompleted(id: string, stripePaymentIntentId: string | null, completedAt: string): Promise<void> {
    await this.dataSource.getRepository(PaymentTransactionOrmEntity).update(
      { id },
      {
        status: "completed",
        stripePaymentIntentId,
        completedAt: new Date(completedAt)
      }
    );
  }

  async markFailed(id: string): Promise<void> {
    await this.dataSource
      .getRepository(PaymentTransactionOrmEntity)
      .update({ id }, { status: "failed" });
  }

}

function toTransaction(row: PaymentTransactionOrmEntity): PaymentTransaction {
  return {
    id: row.id,
    userId: row.userId,
    stripeSessionId: row.stripeSessionId,
    stripePaymentIntentId: row.stripePaymentIntentId,
    packageName: row.packageName,
    creditsPurchased: row.creditsPurchased,
    amountPaid: row.amountPaid,
    currency: row.currency,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null
  };
}
