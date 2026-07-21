import type { GoogleProfile, User } from "@/domain/entities/user";

export interface UserUpsert {
  user: User;
  created: boolean;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  upsertFromGoogle(profile: GoogleProfile): Promise<UserUpsert>;
}
