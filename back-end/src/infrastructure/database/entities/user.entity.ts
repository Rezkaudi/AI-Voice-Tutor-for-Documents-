import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { decimalTransformer } from "../transformers/decimal.transformer";

@Entity({ name: "users" })
export class UserOrmEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ name: "google_id", type: "varchar", length: 255 })
  googleId!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 320 })
  email!: string;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", nullable: true })
  picture!: string | null;

  @Column({ name: "subscription_credits", type: "numeric", precision: 14, scale: 6, default: 0, transformer: decimalTransformer })
  subscriptionCredits!: number;

  @Column({ name: "topup_credits", type: "numeric", precision: 14, scale: 6, default: 0, transformer: decimalTransformer })
  topupCredits!: number;

  @Index({ unique: true })
  @Column({ name: "stripe_customer_id", type: "varchar", length: 255, nullable: true })
  stripeCustomerId!: string | null;

  @Column({ name: "has_purchased", type: "boolean", default: false })
  hasPurchased!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
