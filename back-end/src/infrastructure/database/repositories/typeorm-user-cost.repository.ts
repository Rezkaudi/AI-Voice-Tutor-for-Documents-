import type { DataSource } from "typeorm";
import type { UserCostRepository } from "@/domain/repositories/user-cost-repository";

export class TypeOrmUserCostRepository implements UserCostRepository {
  constructor(private readonly dataSource: DataSource) { }

  async increment(
    userId: string,
    costUsd: number,
    questionDelta: number
  ): Promise<void> {
    await this.dataSource.query(
      `
      INSERT INTO user_ai_costs (user_id, name, total_cost_usd, total_questions)
      SELECT u.id, u.name, $2, $3 FROM users u WHERE u.id = $1
      ON CONFLICT (user_id) DO UPDATE SET
        name            = EXCLUDED.name,
        total_cost_usd  = user_ai_costs.total_cost_usd  + EXCLUDED.total_cost_usd,
        total_questions = user_ai_costs.total_questions + EXCLUDED.total_questions,
        updated_at      = now()
      `,
      [userId, costUsd, questionDelta]
    );
  }
}
