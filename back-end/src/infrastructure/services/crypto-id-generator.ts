import { randomUUID } from "node:crypto";
import type { IdGenerator } from "@/domain/services/id-generator";

export class CryptoIdGenerator implements IdGenerator {
  uuid(): string {
    return randomUUID();
  }
}
