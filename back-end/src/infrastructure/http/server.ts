import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Router, type Application, type RequestHandler } from "express";
import type { Server as HttpServer } from "node:http";
import { corsOptions } from "@/config/cors.config";

import { errorHandler, notFoundHandler } from "@/infrastructure/http/middleware/error-handler";

import type { ChatController } from "@/infrastructure/http/controllers/chat.controller";
import type { DocumentsController } from "@/infrastructure/http/controllers/documents.controller";
import type { SpeechController } from "@/infrastructure/http/controllers/speech.controller";
import type { TranscriptionController } from "@/infrastructure/http/controllers/transcription.controller";
import type { AuthController } from "@/infrastructure/http/controllers/auth.controller";

import { buildChatRoutes } from "@/infrastructure/http/routes/chat.routes";
import { buildDocumentRoutes } from "@/infrastructure/http/routes/documents.routes";
import { buildSpeechRoutes } from "@/infrastructure/http/routes/speech.routes";
import { buildTranscriptionRoutes } from "@/infrastructure/http/routes/transcription.routes";
import { buildAuthRoutes } from "@/infrastructure/http/routes/auth.routes";

import { logger } from "@/shared/logger";

export interface ServerDependencies {
  documents: DocumentsController;
  chat: ChatController;
  speech: SpeechController;
  transcription: TranscriptionController;
  auth: AuthController;
  requireAuth: RequestHandler;
}

export class Server {
  private readonly app: Application;

  constructor(
    private readonly port: number,
    private readonly deps: ServerDependencies
  ) {
    this.app = express();
    this.configureMiddleware();
    this.configureRoutes();
    this.configureErrorHandling();
  }

  private configureMiddleware(): void {
    this.app.set("trust proxy", 1);
    this.app.disable("x-powered-by");

    this.app.use(cors(corsOptions));
    this.app.use(express.json({ limit: "5mb" }));
    this.app.use(cookieParser());
  }

  private configureRoutes(): void {
    const apiRoutes = Router();

    apiRoutes.use(buildAuthRoutes(this.deps.auth, this.deps.requireAuth));
    apiRoutes.use(this.deps.requireAuth);
    apiRoutes.use(buildDocumentRoutes(this.deps.documents));
    apiRoutes.use(buildChatRoutes(this.deps.chat));
    apiRoutes.use(buildSpeechRoutes(this.deps.speech));
    apiRoutes.use(buildTranscriptionRoutes(this.deps.transcription));

    this.app.get("/health", (_req, res) => {
      res.json({ status: "ok" });
    });

    this.app.use("/api", apiRoutes);
  }

  private configureErrorHandling(): void {
    this.app.use(notFoundHandler());
    this.app.use(errorHandler());
  }

  public start(): HttpServer {
    return this.app.listen(this.port, () => {
      logger.info(`API listening on http://localhost:${this.port}`);
    });
  }

  public getApp(): Application {
    return this.app;
  }
}
