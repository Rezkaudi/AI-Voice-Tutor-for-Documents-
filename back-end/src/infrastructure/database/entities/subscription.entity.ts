import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import type { SubscriptionStatus } from "@/domain/entities/subscription";
import { UserOrmEntity } from "./user.entity";
import { decimalTransformer } from "../transformers/decimal.transformer";

@Entity({ name: "subscriptions" })
export class SubscriptionOrmEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => UserOrmEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserOrmEntity;

  @Column({ name: "plan_id", type: "varchar", length: 64 })
  planId!: string;

  @Column({ type: "varchar", length: 16 })
  status!: SubscriptionStatus;

  @Index({ unique: true })
  @Column({ name: "stripe_subscription_id", type: "varchar", length: 255 })
  stripeSubscriptionId!: string;

  @Column({ name: "stripe_customer_id", type: "varchar", length: 255 })
  stripeCustomerId!: string;

  @Column({ name: "current_period_start", type: "timestamptz" })
  currentPeriodStart!: Date;

  @Column({ name: "current_period_end", type: "timestamptz" })
  currentPeriodEnd!: Date;

  @Column({ name: "daily_credits_limit", type: "numeric", precision: 14, scale: 6, transformer: decimalTransformer })
  dailyCreditsLimit!: number;

  @Column({ name: "daily_credits_used", type: "numeric", precision: 14, scale: 6, default: 0, transformer: decimalTransformer })
  dailyCreditsUsed!: number;

  @Column({ name: "last_usage_reset_date", type: "varchar", length: 10 })
  lastUsageResetDate!: string;

  @Column({ name: "cancel_at_period_end", type: "boolean", default: false })
  cancelAtPeriodEnd!: boolean;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
