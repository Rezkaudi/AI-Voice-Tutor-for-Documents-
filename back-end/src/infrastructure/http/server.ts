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
import type { PaymentController } from "@/infrastructure/http/controllers/payment.controller";
import type { SubscriptionController } from "@/infrastructure/http/controllers/subscription.controller";

import { buildChatRoutes } from "@/infrastructure/http/routes/chat.routes";
import { buildDocumentRoutes } from "@/infrastructure/http/routes/documents.routes";
import { buildSpeechRoutes } from "@/infrastructure/http/routes/speech.routes";
import { buildTranscriptionRoutes } from "@/infrastructure/http/routes/transcription.routes";
import { buildAuthRoutes } from "@/infrastructure/http/routes/auth.routes";
import {
  buildPaymentRoutes,
  buildStripeWebhookRoute
} from "@/infrastructure/http/routes/payment.routes";
import { buildSubscriptionRoutes } from "@/infrastructure/http/routes/subscription.routes";

import { logger } from "@/shared/logger";

export interface ServerDependencies {
  documents: DocumentsController;
  chat: ChatController;
  speech: SpeechController;
  transcription: TranscriptionController;
  auth: AuthController;
  payment: PaymentController;
  subscription: SubscriptionController;
  requireAuth: RequestHandler;
  requireCredits: RequestHandler;
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
    // Trust the proxy so `Secure` cookies and client IPs work behind one.
    this.app.set("trust proxy", 1);
    this.app.disable("x-powered-by");

    this.app.use(cors(corsOptions));

    this.app.use("/api", buildStripeWebhookRoute(this.deps.payment));

    // JSON for normal endpoints; multipart bodies are handled per-route by multer.
    this.app.use(express.json({ limit: "5mb" }));
    // Parse the HTTP-only session cookies the auth flow reads.
    this.app.use(cookieParser());
  }

  private configureRoutes(): void {
    const apiRoutes = Router();

    // Auth routes are public (sign-in must work without a session); mount them
    // before the gate. Everything after `requireAuth` needs a valid session.
    apiRoutes.use(buildAuthRoutes(this.deps.auth, this.deps.requireAuth));

    apiRoutes.use(this.deps.requireAuth);
    apiRoutes.use(buildDocumentRoutes(this.deps.documents, this.deps.requireCredits));
    apiRoutes.use(buildChatRoutes(this.deps.chat, this.deps.requireCredits));
    apiRoutes.use(buildSpeechRoutes(this.deps.speech, this.deps.requireCredits));
    apiRoutes.use(buildTranscriptionRoutes(this.deps.transcription, this.deps.requireCredits));
    apiRoutes.use(buildPaymentRoutes(this.deps.payment));
    apiRoutes.use(buildSubscriptionRoutes(this.deps.subscription));

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

  /** Exposes the configured app without binding a port — the seam for supertest integration tests. */
  public getApp(): Application {
    return this.app;
  }
}
