export interface UserCostRepository {
  increment(userId: string, costUsd: number, questionDelta: number): Promise<void>;
}
