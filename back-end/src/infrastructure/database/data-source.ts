import "reflect-metadata";
import { DataSource } from "typeorm";
import { ENV_CONFIG } from "../../config/env.config";

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
      console.log("✅ Database connection established");
    }

    return AppDataSource;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
};
