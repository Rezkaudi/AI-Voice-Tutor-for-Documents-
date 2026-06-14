import type { DataSource } from "typeorm";

import { DeleteDocumentUseCase } from "@/application/use-cases/documents/delete-document.use-case";
import { GetDocumentUseCase } from "@/application/use-cases/documents/get-document.use-case";
import { GetDocumentFileUseCase } from "@/application/use-cases/documents/get-document-file.use-case";
import { ListDocumentsUseCase } from "@/application/use-cases/documents/list-documents.use-case";
import { UploadDocumentUseCase } from "@/application/use-cases/documents/upload-document.use-case";
import { StreamChatUseCase } from "@/application/use-cases/chat/stream-chat.use-case";
import { SynthesizeSpeechUseCase } from "@/application/use-cases/speech/synthesize-speech.use-case";
import { TranscribeAudioUseCase } from "@/application/use-cases/transcription/transcribe-audio.use-case";
import { GetGoogleAuthUrlUseCase } from "@/application/use-cases/auth/get-google-auth-url.use-case";
import { AuthenticateWithGoogleUseCase } from "@/application/use-cases/auth/authenticate-with-google.use-case";
import { RefreshSessionUseCase } from "@/application/use-cases/auth/refresh-session.use-case";
import { GetCurrentUserUseCase } from "@/application/use-cases/auth/get-current-user.use-case";

import { CreateCheckoutSessionUseCase } from "@/application/use-cases/payment/create-checkout-session.use-case";
import { HandleStripeWebhookUseCase } from "@/application/use-cases/payment/handle-stripe-webhook.use-case";
import { GetUserBalanceUseCase } from "@/application/use-cases/payment/get-user-balance.use-case";
import { PollPaymentStatusUseCase } from "@/application/use-cases/payment/poll-payment-status.use-case";
import { CreateSubscriptionCheckoutUseCase } from "@/application/use-cases/subscription/create-subscription-checkout.use-case";
import { GetSubscriptionStatusUseCase } from "@/application/use-cases/subscription/get-subscription-status.use-case";
import { CancelSubscriptionUseCase } from "@/application/use-cases/subscription/cancel-subscription.use-case";
import { ResumeSubscriptionUseCase } from "@/application/use-cases/subscription/resume-subscription.use-case";
import { GetAvailablePlansUseCase } from "@/application/use-cases/subscription/get-available-plans.use-case";

import { TextTokenizer } from "@/domain/logic/text-tokenizer";
import { ChunkRanker } from "@/domain/logic/chunk-ranker";
import { CitationResolver } from "@/domain/logic/citation-resolver";
import { TextNormalizer } from "@/domain/logic/citation/text-normalizer";
import { TokenSimilarity } from "@/domain/logic/citation/token-similarity";
import { QuoteLocator } from "@/domain/logic/citation/quote-locator";
import { SentenceSplitter } from "@/domain/logic/citation/sentence-splitter";
import { AnswerAutoCiter } from "@/domain/logic/citation/answer-auto-citer";
import { DocumentReferenceFactory } from "@/domain/logic/citation/document-reference-factory";
import { ReferenceSelector } from "@/domain/logic/citation/reference-selector";
import { CitationMarkerReconciler } from "@/domain/logic/citation/citation-marker-reconciler";
import { DocumentChunker } from "@/domain/logic/document-chunker";
import { UploadValidator } from "@/domain/logic/upload-validator";
import { FileNaming } from "@/domain/logic/file-naming";
import { ChatHistorySanitizer } from "@/domain/logic/chat-history-sanitizer";

import { initializeDatabase } from "@/infrastructure/database/data-source";
import { TypeOrmDocumentRepository } from "@/infrastructure/database/repositories/typeorm-document.repository";
import { TypeOrmUserRepository } from "@/infrastructure/database/repositories/typeorm-user.repository";
import { TypeOrmSubscriptionRepository } from "@/infrastructure/database/repositories/typeorm-subscription.repository";
import { TypeOrmPaymentTransactionRepository } from "@/infrastructure/database/repositories/typeorm-payment-transaction.repository";

import { GoogleOAuthService } from "@/infrastructure/services/auth/google-oauth.service";
import { JwtTokenService } from "@/infrastructure/services/auth/jwt-token.service";
import { CryptoIdGenerator } from "@/infrastructure/services/crypto-id-generator";
import { StripeService } from "@/infrastructure/services/payment/stripe.service";
import { CreditService } from "@/infrastructure/services/payment/credit.service";

import { S3FileStorage } from "@/infrastructure/services/storage/s3-file-storage";
import { PdfJsTextExtractor } from "@/infrastructure/services/documents/pdfjs-text-extractor";
import { OpenAiTutorService } from "@/infrastructure/services/ai/openai-tutor.service";
import { TutorToolExecutor } from "@/infrastructure/services/ai/tutor-tool-executor";
import { OpenAiEmbeddingService } from "@/infrastructure/services/ai/openai-embedding.service";
import { OpenAiSpeechSynthesisService, OpenAiTranscriptionService } from "@/infrastructure/services/ai/openai-speech.service";
import { ConsoleLogger } from "@/infrastructure/logging/console-logger";
import { ConsoleCostReporter } from "@/infrastructure/logging/console-cost-reporter";
import { CostCalculator } from "@/domain/logic/cost/cost-calculator";
import { PRICING } from "@/config/pricing.config";

import { DocumentsController } from "@/infrastructure/http/controllers/documents.controller";
import { ChatController } from "@/infrastructure/http/controllers/chat.controller";
import { SpeechController } from "@/infrastructure/http/controllers/speech.controller";
import { TranscriptionController } from "@/infrastructure/http/controllers/transcription.controller";
import { AuthController } from "@/infrastructure/http/controllers/auth.controller";
import { PaymentController } from "@/infrastructure/http/controllers/payment.controller";
import { SubscriptionController } from "@/infrastructure/http/controllers/subscription.controller";
import { buildRequireAuth } from "@/infrastructure/http/middleware/require-auth";
import { buildRequireCredits } from "@/infrastructure/http/middleware/require-credits";
import type { ServerDependencies } from "@/infrastructure/http/server";

import { ENV_CONFIG } from "@/config/env.config";

/**
 * Composition root — the single place that knows every concrete class.
 *
 * It wires the dependency graph inward: infrastructure adapters → application
 * use cases → HTTP controllers. Swapping an adapter (S3 → GCS, OpenAI → another
 * provider) changes this file alone.
 */
export interface Container {
  dataSource: DataSource;
  deps: ServerDependencies;
}

export async function buildContainer(): Promise<Container> {
  // ─── Cross-cutting ───────────────────────────────────────────────────────
  // One logger, injected as the `Logger` port wherever a flow needs tracing.
  // Verbosity is decided here, once, from the environment.
  const logger = new ConsoleLogger(ENV_CONFIG.TUTOR_LOG_VERBOSE);
  // Single id/token source, injected wherever a UUID or random token is needed.
  const idGenerator = new CryptoIdGenerator();

  const costCalculator = new CostCalculator(PRICING);
  const costReporter = new ConsoleCostReporter();

  // ─── Persistence ─────────────────────────────────────────────────────────
  const dataSource = await initializeDatabase();

  // ─── Domain services (pure business logic) ───────────────────────────────
  const tokenizer = new TextTokenizer();
  const chunkRanker = new ChunkRanker(tokenizer);
  const quoteLocator = new QuoteLocator(new TextNormalizer(), new TokenSimilarity());
  const answerAutoCiter = new AnswerAutoCiter(tokenizer, new SentenceSplitter());
  const citationResolver = new CitationResolver(quoteLocator, answerAutoCiter);
  const referenceFactory = new DocumentReferenceFactory();
  const referenceSelector = new ReferenceSelector(citationResolver, referenceFactory);
  const citationMarkerReconciler = new CitationMarkerReconciler();
  const documentChunker = new DocumentChunker(idGenerator);
  const uploadValidator = new UploadValidator();
  const fileNaming = new FileNaming();
  const historySanitizer = new ChatHistorySanitizer();

  // ─── Infrastructure adapters (implement domain ports) ────────────────────
  const documentRepository = new TypeOrmDocumentRepository(dataSource, idGenerator);
  const userRepository = new TypeOrmUserRepository(dataSource, idGenerator);
  const subscriptionRepository = new TypeOrmSubscriptionRepository(dataSource);
  const paymentTransactionRepository = new TypeOrmPaymentTransactionRepository(
    dataSource
  );

  // Credit economy: gates billable AI calls and deducts their real cost.
  const creditService = new CreditService(
    userRepository,
    subscriptionRepository,
    ENV_CONFIG,
    logger
  );
  const paymentGateway = new StripeService(ENV_CONFIG);

  const oauthProvider = new GoogleOAuthService(ENV_CONFIG);
  const tokenService = new JwtTokenService(ENV_CONFIG);
  const fileStorage = new S3FileStorage(ENV_CONFIG);
  const textExtractor = new PdfJsTextExtractor();
  const embeddingService = new OpenAiEmbeddingService(
    ENV_CONFIG,
    logger,
    costCalculator,
    costReporter
  );
  const tutorToolExecutor = new TutorToolExecutor(
    embeddingService,
    chunkRanker,
    referenceFactory
  );
  const tutorService = new OpenAiTutorService(
    ENV_CONFIG,
    tutorToolExecutor,
    referenceSelector,
    citationMarkerReconciler,
    logger,
    costCalculator,
    costReporter,
    creditService
  );
  const speechService = new OpenAiSpeechSynthesisService(
    ENV_CONFIG,
    costCalculator,
    costReporter,
    creditService
  );
  const transcriptionService = new OpenAiTranscriptionService(
    ENV_CONFIG,
    costCalculator,
    costReporter,
    creditService
  );

  // ─── Application use cases ───────────────────────────────────────────────
  const uploadDocument = new UploadDocumentUseCase(
    documentRepository,
    fileStorage,
    textExtractor,
    embeddingService,
    uploadValidator,
    documentChunker,
    fileNaming,
    idGenerator,
    logger
  );
  const getDocument = new GetDocumentUseCase(documentRepository);
  const getDocumentFile = new GetDocumentFileUseCase(
    documentRepository,
    fileStorage
  );
  const listDocuments = new ListDocumentsUseCase(documentRepository);
  const deleteDocument = new DeleteDocumentUseCase(documentRepository, fileStorage);
  const streamChat = new StreamChatUseCase(
    documentRepository,
    tutorService,
    historySanitizer,
    logger
  );
  const synthesizeSpeech = new SynthesizeSpeechUseCase(speechService, logger);
  const transcribeAudio = new TranscribeAudioUseCase(transcriptionService, logger);

  const getGoogleAuthUrl = new GetGoogleAuthUrlUseCase(oauthProvider, idGenerator);
  const authenticateWithGoogle = new AuthenticateWithGoogleUseCase(
    oauthProvider,
    userRepository,
    tokenService
  );
  const refreshSession = new RefreshSessionUseCase(userRepository, tokenService);
  const getCurrentUser = new GetCurrentUserUseCase(userRepository);

  // ─── Billing use cases ───────────────────────────────────────────────────
  const createCheckoutSession = new CreateCheckoutSessionUseCase(
    userRepository,
    paymentTransactionRepository,
    paymentGateway,
    idGenerator,
    ENV_CONFIG,
    logger
  );
  const handleStripeWebhook = new HandleStripeWebhookUseCase(
    userRepository,
    subscriptionRepository,
    paymentTransactionRepository,
    paymentGateway,
    idGenerator,
    logger
  );
  const getUserBalance = new GetUserBalanceUseCase(userRepository);
  const pollPaymentStatus = new PollPaymentStatusUseCase(
    paymentTransactionRepository,
    userRepository
  );
  const createSubscriptionCheckout = new CreateSubscriptionCheckoutUseCase(
    userRepository,
    subscriptionRepository,
    paymentGateway,
    ENV_CONFIG,
    logger
  );
  const getSubscriptionStatus = new GetSubscriptionStatusUseCase(
    subscriptionRepository
  );
  const cancelSubscription = new CancelSubscriptionUseCase(
    subscriptionRepository,
    paymentGateway,
    logger
  );
  const resumeSubscription = new ResumeSubscriptionUseCase(
    subscriptionRepository,
    paymentGateway,
    logger
  );
  const getAvailablePlans = new GetAvailablePlansUseCase();

  // The gate every protected route shares, built from the same token service.
  const requireAuth = buildRequireAuth(tokenService);
  // The paywall preflight applied to billable AI routes.
  const requireCredits = buildRequireCredits(creditService);

  // ─── HTTP controllers ────────────────────────────────────────────────────
  const deps: ServerDependencies = {
    documents: new DocumentsController(
      uploadDocument,
      getDocument,
      getDocumentFile,
      listDocuments,
      deleteDocument
    ),
    chat: new ChatController(streamChat),
    speech: new SpeechController(synthesizeSpeech),
    transcription: new TranscriptionController(transcribeAudio),
    auth: new AuthController(
      getGoogleAuthUrl,
      authenticateWithGoogle,
      refreshSession,
      getCurrentUser
    ),
    payment: new PaymentController(
      createCheckoutSession,
      handleStripeWebhook,
      getUserBalance,
      pollPaymentStatus
    ),
    subscription: new SubscriptionController(
      createSubscriptionCheckout,
      getSubscriptionStatus,
      cancelSubscription,
      resumeSubscription,
      getAvailablePlans
    ),
    requireAuth,
    requireCredits
  };

  return { dataSource, deps };
}
