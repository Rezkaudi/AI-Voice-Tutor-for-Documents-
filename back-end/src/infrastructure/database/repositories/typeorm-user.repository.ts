import type { DataSource } from "typeorm";
import type { GoogleProfile, User } from "@/domain/entities/user";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { IdGenerator } from "@/domain/services/id-generator";
import { UserOrmEntity } from "../entities/user.entity";

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
}

/** Maps a persistence row into the framework-free domain user. */
function toUser(row: UserOrmEntity): User {
  return {
    id: row.id,
    googleId: row.googleId,
    email: row.email,
    name: row.name,
    picture: row.picture,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
