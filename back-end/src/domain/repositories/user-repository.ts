import type { GoogleProfile, User } from "@/domain/entities/user";

export interface SpendResult {
  subscriptionCredits: number;
  topupCredits: number;
  fromSubscription: number;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  upsertFromGoogle(profile: GoogleProfile): Promise<User>;
  addTopupCredits(userId: string, credits: number): Promise<number>;
  setSubscriptionCredits(userId: string, credits: number): Promise<number>;
  spendCredits(userId: string, credits: number): Promise<SpendResult>;
  setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void>;
  markPurchased(userId: string): Promise<void>;
  findByStripeCustomerId(stripeCustomerId: string): Promise<User | null>;
}
