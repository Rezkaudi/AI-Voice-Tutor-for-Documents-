import "reflect-metadata";
import { DataSource } from "typeorm";
import { ENV_CONFIG } from "../../config/env.config";
import type { Logger } from "../../domain/services/logger";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: ENV_CONFIG.DATABASE_URL,
  entities: [__dirname + "/entities/*.entity{.ts,.js}"],
  migrations: [__dirname + "/migrations/*{.ts,.js}"],
  synchronize: ENV_CONFIG.DB_SYNCHRONIZE && ENV_CONFIG.NODE_ENV !== "production",
  logging: ENV_CONFIG.DB_LOGGING
});

export const initializeDatabase = async (logger: Logger): Promise<DataSource> => {
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
