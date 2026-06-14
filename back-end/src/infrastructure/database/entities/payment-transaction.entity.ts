import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import type { PaymentTransactionStatus } from "@/domain/entities/payment-transaction";
import { UserOrmEntity } from "./user.entity";

@Entity({ name: "payment_transactions" })

export class PaymentTransactionOrmEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => UserOrmEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserOrmEntity;

  @Index({ unique: true })
  @Column({ name: "stripe_session_id", type: "varchar", length: 255 })
  stripeSessionId!: string;

  @Column({ name: "stripe_payment_intent_id", type: "varchar", length: 255, nullable: true })
  stripePaymentIntentId!: string | null;

  @Column({ name: "package_name", type: "varchar", length: 128 })
  packageName!: string;

  @Column({ name: "credits_purchased", type: "int" })
  creditsPurchased!: number;

  @Column({ name: "amount_paid", type: "int" })
  amountPaid!: number;

  @Column({ type: "varchar", length: 8, default: "usd" })
  currency!: string;

  @Column({ type: "varchar", length: 16 })
  status!: PaymentTransactionStatus;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt!: Date | null;
}
