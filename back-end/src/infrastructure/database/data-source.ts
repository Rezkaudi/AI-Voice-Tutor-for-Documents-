import "reflect-metadata";
import { DataSource } from "typeorm";
// Relative path (not the `@/` alias): the TypeORM CLI loads this file without
// the tsconfig path-resolution that the running app gets via tsc-alias/tsx.
import { ENV_CONFIG } from "../../config/env.config";
import { logger } from "../../shared/logger";

/**
 * The single TypeORM `DataSource`, used by the running application and the
 * TypeORM CLI alike.
 */
export const AppDataSource = new DataSource({
  type: "postgres",
  url: ENV_CONFIG.DATABASE_URL,
  entities: [__dirname + "/entities/*.entity{.ts,.js}"],
  migrations: [__dirname + "/migrations/*{.ts,.js}"],
  // Convenient in development; production should run migrations and keep this off.
  synchronize:
    ENV_CONFIG.DB_SYNCHRONIZE && ENV_CONFIG.NODE_ENV !== "production",
  logging: ENV_CONFIG.DB_LOGGING
});

export const initializeDatabase = async (): Promise<DataSource> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info("Database connection established.");
    }

    return AppDataSource;
  } catch (error) {
    logger.error("Database connection failed", error);
    throw error;
  }
};
