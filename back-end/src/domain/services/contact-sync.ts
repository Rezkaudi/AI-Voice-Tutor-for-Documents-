import type { User } from "@/domain/entities/user";

export interface ContactSync {
  syncUser(user: User): Promise<void>;
}
