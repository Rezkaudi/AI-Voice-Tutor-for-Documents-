import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn
} from "typeorm";
import { UserOrmEntity } from "./user.entity";

@Entity({ name: "user_ai_costs" })
export class UserCostOrmEntity {
  @PrimaryColumn("uuid", { name: "user_id" })
  userId!: string;

  @OneToOne(() => UserOrmEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserOrmEntity;

  @Column({ type: "text" })
  name!: string;

  @Column({ name: "total_cost_usd", type: "numeric", precision: 16, scale: 8, default: 0 })
  totalCostUsd!: string;

  @Column({ name: "total_questions", type: "integer", default: 0 })
  totalQuestions!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
