import type { DataSource } from "typeorm";

import type { Subscription, SubscriptionStatus } from "@/domain/entities/subscription";
import type { DailyUsageResult, SubscriptionRepository } from "@/domain/repositories/subscription-repository";

import { SubscriptionOrmEntity } from "../entities/subscription.entity";
import { firstReturnedRow } from "../query-result";

export class TypeOrmSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly dataSource: DataSource) { }

  async findActiveByUserId(userId: string): Promise<Subscription | null> {
    const row = await this.dataSource
      .getRepository(SubscriptionOrmEntity)
      .findOne({
        where: { userId, status: "active" },
        order: { currentPeriodEnd: "DESC" }
      });
    return row ? toSubscription(row) : null;
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const row = await this.dataSource
      .getRepository(SubscriptionOrmEntity)
      .findOne({ where: { stripeSubscriptionId } });
    return row ? toSubscription(row) : null;
  }

  async upsert(subscription: Subscription): Promise<Subscription> {
    const repository = this.dataSource.getRepository(SubscriptionOrmEntity);
    const existing = await repository.findOne({
      where: { stripeSubscriptionId: subscription.stripeSubscriptionId }
    });

    const row = existing ?? new SubscriptionOrmEntity();
    row.id = existing?.id ?? subscription.id;
    row.userId = subscription.userId;
    row.planId = subscription.planId;
    row.status = subscription.status;
    row.stripeSubscriptionId = subscription.stripeSubscriptionId;
    row.stripeCustomerId = subscription.stripeCustomerId;
    row.currentPeriodStart = new Date(subscription.currentPeriodStart);
    row.currentPeriodEnd = new Date(subscription.currentPeriodEnd);
    row.dailyCreditsLimit = subscription.dailyCreditsLimit;
    row.dailyCreditsUsed = subscription.dailyCreditsUsed;
    row.lastUsageResetDate = subscription.lastUsageResetDate;
    row.cancelAtPeriodEnd = subscription.cancelAtPeriodEnd;
    row.createdAt = existing?.createdAt ?? new Date(subscription.createdAt);
    row.updatedAt = new Date(subscription.updatedAt);

    const saved = await repository.save(row);
    return toSubscription(saved);
  }

  async updateStatus(id: string, status: SubscriptionStatus): Promise<void> {
    await this.dataSource
      .getRepository(SubscriptionOrmEntity)
      .update({ id }, { status, updatedAt: new Date() });
  }

  async incrementDailyCreditsUsed(
    id: string,
    credits: number,
    today: string
  ): Promise<DailyUsageResult> {
    const result = await this.dataSource.query(
      `WITH prev AS (
         SELECT "last_usage_reset_date" <> $2 AS was_reset
         FROM "subscriptions" WHERE "id" = $3
       )
       UPDATE "subscriptions" s
       SET "daily_credits_used" = CASE
             WHEN s."last_usage_reset_date" <> $2 THEN $1
             ELSE s."daily_credits_used" + $1 END,
           "last_usage_reset_date" = $2,
           "updated_at" = now()
       FROM prev
       WHERE s."id" = $3
       RETURNING s."daily_credits_used", prev.was_reset`,
      [credits, today, id]
    );
    const row = firstReturnedRow<{ daily_credits_used: string; was_reset: boolean }>(
      result
    );
    return {
      dailyCreditsUsed: Number(row?.daily_credits_used ?? 0),
      wasReset: Boolean(row?.was_reset)
    };
  }
}

function toSubscription(row: SubscriptionOrmEntity): Subscription {
  return {
    id: row.id,
    userId: row.userId,
    planId: row.planId,
    status: row.status,
    stripeSubscriptionId: row.stripeSubscriptionId,
    stripeCustomerId: row.stripeCustomerId,
    currentPeriodStart: row.currentPeriodStart.toISOString(),
    currentPeriodEnd: row.currentPeriodEnd.toISOString(),
    dailyCreditsLimit: row.dailyCreditsLimit,
    dailyCreditsUsed: row.dailyCreditsUsed,
    lastUsageResetDate: row.lastUsageResetDate,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
