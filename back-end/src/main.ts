import "reflect-metadata";
import type { Server as HttpServer } from "node:http";
import { buildContainer } from "@/container";
import { ENV_CONFIG } from "@/config/env.config";
import { Server } from "@/infrastructure/http/server";
import { logger } from "@/shared/logger";

/**
 * Process entry point: builds the dependency graph, starts the HTTP server,
 * and shuts both down cleanly on SIGINT / SIGTERM.
 */
async function bootstrap(): Promise<void> {
  const { dataSource, deps } = await buildContainer();
  const appServer = new Server(ENV_CONFIG.PORT, deps);
  const httpServer: HttpServer = appServer.start();

  const shutdown = (signal: string): void => {
    logger.info(`${signal} received — shutting down.`);
    httpServer.close(async () => {
      try {
        if (dataSource.isInitialized) {
          await dataSource.destroy();
        }
      } catch (error) {
        logger.error("Error during database shutdown", error);
      } finally {
        process.exit(0);
      }
    });
    // Force-exit if connections do not drain in time.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  logger.error("Fatal error during startup", error);
  process.exit(1);
});
