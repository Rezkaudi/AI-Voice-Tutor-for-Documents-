import type { DataSource } from "typeorm";
import type { GoogleProfile, User } from "@/domain/entities/user";
import type { SpendResult, UserRepository } from "@/domain/repositories/user-repository";
import type { IdGenerator } from "@/domain/services/id-generator";
import { UserOrmEntity } from "../entities/user.entity";
import { firstReturnedRow } from "../query-result";

export class TypeOrmUserRepository implements UserRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly idGenerator: IdGenerator
  ) { }

  async findById(id: string): Promise<User | null> {
    const row = await this.dataSource
      .getRepository(UserOrmEntity)
      .findOne({ where: { id } });
    return row ? toUser(row) : null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const row = await this.dataSource
      .getRepository(UserOrmEntity)
      .findOne({ where: { googleId } });
    return row ? toUser(row) : null;
  }

  async upsertFromGoogle(profile: GoogleProfile): Promise<User> {
    const repository = this.dataSource.getRepository(UserOrmEntity);
    const existing = await repository.findOne({
      where: { googleId: profile.googleId }
    });

    const row = existing ?? new UserOrmEntity();
    if (!existing) {
      row.id = this.idGenerator.uuid();
      row.googleId = profile.googleId;
    }
    // Refresh the mutable profile fields on every sign-in.
    row.email = profile.email;
    row.name = profile.name;
    row.picture = profile.picture;

    const saved = await repository.save(row);
    return toUser(saved);
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
    const row = await this.dataSource
      .getRepository(UserOrmEntity)
      .findOne({ where: { stripeCustomerId } });
    return row ? toUser(row) : null;
  }

  async addTopupCredits(userId: string, credits: number): Promise<number> {
    const result = await this.dataSource.query(
      `UPDATE "users"
       SET "topup_credits" = "topup_credits" + $1, "updated_at" = now()
       WHERE "id" = $2 RETURNING "topup_credits"`,
      [credits, userId]
    );
    const row = firstReturnedRow<{ topup_credits: string }>(result);
    return Number(row?.topup_credits ?? 0);
  }

  async setSubscriptionCredits(
    userId: string,
    credits: number
  ): Promise<number> {
    const result = await this.dataSource.query(
      `UPDATE "users" SET "subscription_credits" = $1, "updated_at" = now()
       WHERE "id" = $2 RETURNING "subscription_credits"`,
      [credits, userId]
    );
    const row = firstReturnedRow<{ subscription_credits: string }>(result);
    return Number(row?.subscription_credits ?? 0);
  }

  async spendCredits(userId: string, credits: number, maxFromSubscription?: number): Promise<SpendResult> {
    const subCap = maxFromSubscription === undefined
      ? credits
      : Math.max(0, maxFromSubscription);
    const result = await this.dataSource.query(
      `WITH cur AS (
         SELECT "subscription_credits" AS sc FROM "users" WHERE "id" = $2 FOR UPDATE
       ),
       calc AS (SELECT LEAST($1, GREATEST(sc, 0), $3) AS from_sub FROM cur)
       UPDATE "users" u
       SET "subscription_credits" = u."subscription_credits" - (SELECT from_sub FROM calc),
           "topup_credits" = u."topup_credits" - ($1 - (SELECT from_sub FROM calc)),
           "updated_at" = now()
       WHERE u."id" = $2
       RETURNING u."subscription_credits", u."topup_credits",
                 (SELECT from_sub FROM calc) AS from_sub`,
      [credits, userId, subCap]
    );
    const r = firstReturnedRow<{
      subscription_credits: string;
      topup_credits: string;
      from_sub: string;
    }>(result);
    return {
      subscriptionCredits: Number(r?.subscription_credits ?? 0),
      topupCredits: Number(r?.topup_credits ?? 0),
      fromSubscription: Number(r?.from_sub ?? 0)
    };
  }

  async setStripeCustomerId(
    userId: string,
    stripeCustomerId: string
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE "users" SET "stripe_customer_id" = $1, "updated_at" = now() WHERE "id" = $2`,
      [stripeCustomerId, userId]
    );
  }

  async markPurchased(userId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE "users" SET "has_purchased" = true, "updated_at" = now() WHERE "id" = $1`,
      [userId]
    );
  }
}

/** Maps a persistence row into the framework-free domain user. */
function toUser(row: UserOrmEntity): User {
  return {
    id: row.id,
    googleId: row.googleId,
    email: row.email,
    name: row.name,
    picture: row.picture,
    subscriptionCredits: row.subscriptionCredits,
    topupCredits: row.topupCredits,
    stripeCustomerId: row.stripeCustomerId,
    hasPurchased: row.hasPurchased,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
