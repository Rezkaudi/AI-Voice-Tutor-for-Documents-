import type { DataSource } from "typeorm";

import { DeleteDocumentUseCase } from "@/application/use-cases/documents/delete-document.use-case";
import { EndLessonSessionUseCase } from "@/application/use-cases/documents/end-lesson-session.use-case";
import { GetDocumentUseCase } from "@/application/use-cases/documents/get-document.use-case";
import { GetDocumentFileUseCase } from "@/application/use-cases/documents/get-document-file.use-case";
import { ListDocumentsUseCase } from "@/application/use-cases/documents/list-documents.use-case";
import { UploadDocumentUseCase } from "@/application/use-cases/documents/upload-document.use-case";
import { CreateUploadUrlUseCase } from "@/application/use-cases/documents/create-upload-url.use-case";
import { RegisterUploadUseCase } from "@/application/use-cases/documents/register-upload.use-case";
import { LoadLessonPagesUseCase } from "@/application/use-cases/documents/load-lesson-pages.use-case";
import { StreamChatUseCase } from "@/application/use-cases/chat/stream-chat.use-case";
import { SynthesizeSpeechUseCase } from "@/application/use-cases/speech/synthesize-speech.use-case";
import { TranscribeAudioUseCase } from "@/application/use-cases/transcription/transcribe-audio.use-case";
import { CostTracker } from "@/application/services/cost-tracker";
import { GetGoogleAuthUrlUseCase } from "@/application/use-cases/auth/get-google-auth-url.use-case";
import { AuthenticateWithGoogleUseCase } from "@/application/use-cases/auth/authenticate-with-google.use-case";
import { RefreshSessionUseCase } from "@/application/use-cases/auth/refresh-session.use-case";
import { GetCurrentUserUseCase } from "@/application/use-cases/auth/get-current-user.use-case";

import { ChunkRanker } from "@/domain/logic/retrieval/chunk-ranker";
import { CitationResolver } from "@/domain/logic/citation/citation-resolver";
import { TextNormalizer } from "@/domain/logic/citation/text-normalizer";
import { TokenSimilarity } from "@/domain/logic/citation/token-similarity";
import { QuoteLocator } from "@/domain/logic/citation/quote-locator";
import { DocumentReferenceFactory } from "@/domain/logic/citation/document-reference-factory";
import { ReferenceSelector } from "@/domain/logic/citation/reference-selector";
import { CitationMarkerReconciler } from "@/domain/logic/citation/citation-marker-reconciler";
import { LearnerQuestionExtractor } from "@/domain/logic/question/learner-question-extractor";
import { DocumentChunker } from "@/domain/logic/retrieval/document-chunker";
import { UploadValidator } from "@/domain/logic/upload-validator";
import { FileNaming } from "@/domain/logic/file-naming";
import { ChatHistorySanitizer } from "@/domain/logic/chat-history-sanitizer";
import { CostCalculator } from "@/domain/logic/cost/cost-calculator";

import { initializeDatabase } from "@/infrastructure/database/data-source";
import { TypeOrmDocumentRepository } from "@/infrastructure/database/repositories/typeorm-document.repository";
import { TypeOrmUserRepository } from "@/infrastructure/database/repositories/typeorm-user.repository";
import { TypeOrmUserCostRepository } from "@/infrastructure/database/repositories/typeorm-user-cost.repository";

import { GoogleOAuthService } from "@/infrastructure/services/auth/google-oauth.service";
import { JwtTokenService } from "@/infrastructure/services/auth/jwt-token.service";
import { CryptoIdGenerator } from "@/infrastructure/services/generators/crypto-id-generator";

import { S3FileStorage } from "@/infrastructure/services/storage/s3-file-storage";
import { PdfJsTextExtractor } from "@/infrastructure/services/documents/pdfjs-text-extractor";
import { InMemoryPageCache } from "@/infrastructure/services/cache/in-memory-page-cache";
import { OpenAiTutorService } from "@/infrastructure/services/ai/openai-tutor.service";
import { TutorToolExecutor } from "@/infrastructure/services/ai/tutor-tool-executor";
import { OpenAiEmbeddingService } from "@/infrastructure/services/ai/openai-embedding.service";
import { OpenAiTextToSpeechService } from "@/infrastructure/services/ai/openai-text-to-speech.service";
import { OpenAiSpeechToTextService } from "@/infrastructure/services/ai/openai-speech-to-text.service";
import { ConsoleLogger } from "@/infrastructure/logging/console-logger";

import { DocumentsController } from "@/infrastructure/http/controllers/documents.controller";
import { ChatController } from "@/infrastructure/http/controllers/chat.controller";
import { SpeechController } from "@/infrastructure/http/controllers/speech.controller";
import { TranscriptionController } from "@/infrastructure/http/controllers/transcription.controller";
import { AuthController } from "@/infrastructure/http/controllers/auth.controller";
import { buildRequireAuth } from "@/infrastructure/http/middleware/require-auth";
import type { ServerDependencies } from "@/infrastructure/http/server";

import { ENV_CONFIG } from "@/config/env.config";
import { MODEL_PRICING } from "@/config/pricing.config";

export interface Container {
  dataSource: DataSource;
  deps: ServerDependencies;
}

export async function buildContainer(): Promise<Container> {
  const logger = new ConsoleLogger(ENV_CONFIG.TUTOR_LOG_VERBOSE);
  const idGenerator = new CryptoIdGenerator();

  // ─── Persistence ─────────────────────────────────────────────────────────
  const dataSource = await initializeDatabase(logger);

  // ─── Domain services (pure business logic) ───────────────────────────────
  const tokenizer = new TokenSimilarity();
  const textNormalizer = new TextNormalizer();
  const chunkRanker = new ChunkRanker(tokenizer);
  const quoteLocator = new QuoteLocator(textNormalizer, tokenizer);
  const citationResolver = new CitationResolver(quoteLocator, textNormalizer);
  const referenceFactory = new DocumentReferenceFactory();
  const referenceSelector = new ReferenceSelector(citationResolver, referenceFactory);
  const citationMarkerReconciler = new CitationMarkerReconciler();
  const learnerQuestionExtractor = new LearnerQuestionExtractor();
  const documentChunker = new DocumentChunker(idGenerator, textNormalizer);
  const uploadValidator = new UploadValidator();
  const fileNaming = new FileNaming();
  const historySanitizer = new ChatHistorySanitizer();
  const costCalculator = new CostCalculator(MODEL_PRICING, logger);

  // ─── Infrastructure adapters (implement domain ports) ────────────────────
  const documentRepository = new TypeOrmDocumentRepository(dataSource, idGenerator);
  const userRepository = new TypeOrmUserRepository(dataSource, idGenerator);
  const userCostRepository = new TypeOrmUserCostRepository(dataSource);
  const oauthProvider = new GoogleOAuthService(ENV_CONFIG);
  const tokenService = new JwtTokenService(ENV_CONFIG);
  const fileStorage = new S3FileStorage(ENV_CONFIG);
  const textExtractor = PdfJsTextExtractor.createDefault();
  const pageCache = new InMemoryPageCache();
  const embeddingService = new OpenAiEmbeddingService(ENV_CONFIG, logger);
  const tutorToolExecutor = new TutorToolExecutor(embeddingService, chunkRanker, referenceFactory);
  const tutorService = new OpenAiTutorService(
    ENV_CONFIG,
    tutorToolExecutor,
    referenceSelector,
    citationMarkerReconciler,
    learnerQuestionExtractor,
    logger
  );
  const speechService = new OpenAiTextToSpeechService(ENV_CONFIG);
  const transcriptionService = new OpenAiSpeechToTextService(ENV_CONFIG);

  // Single seam every AI flow calls to bill a user's usage (USD + questions).
  const costTracker = new CostTracker(userCostRepository, costCalculator, logger);

  // ─── Application use cases ───────────────────────────────────────────────
  const uploadDocument = new UploadDocumentUseCase(
    documentRepository,
    fileStorage,
    textExtractor,
    uploadValidator,
    fileNaming,
    idGenerator,
    logger
  );
  const createUploadUrl = new CreateUploadUrlUseCase(
    fileStorage,
    uploadValidator,
    fileNaming,
    idGenerator,
    logger
  );
  const registerUpload = new RegisterUploadUseCase(
    documentRepository,
    fileStorage,
    uploadValidator,
    fileNaming,
    logger
  );
  const loadLessonPages = new LoadLessonPagesUseCase(
    fileStorage,
    textExtractor,
    pageCache,
    logger
  );
  const getDocument = new GetDocumentUseCase(documentRepository);
  const getDocumentFile = new GetDocumentFileUseCase(
    documentRepository,
    fileStorage
  );
  const listDocuments = new ListDocumentsUseCase(documentRepository);
  const deleteDocument = new DeleteDocumentUseCase(documentRepository, fileStorage);
  const endLessonSession = new EndLessonSessionUseCase(pageCache);
  const streamChat = new StreamChatUseCase(
    documentRepository,
    tutorService,
    historySanitizer,
    loadLessonPages,
    costTracker,
    logger
  );
  const synthesizeSpeech = new SynthesizeSpeechUseCase(
    speechService,
    costTracker,
    logger
  );
  const transcribeAudio = new TranscribeAudioUseCase(
    transcriptionService,
    costTracker,
    logger
  );

  const getGoogleAuthUrl = new GetGoogleAuthUrlUseCase(oauthProvider, idGenerator);
  const authenticateWithGoogle = new AuthenticateWithGoogleUseCase(
    oauthProvider,
    userRepository,
    tokenService
  );
  const refreshSession = new RefreshSessionUseCase(userRepository, tokenService);
  const getCurrentUser = new GetCurrentUserUseCase(userRepository);

  // The gate every protected route shares, built from the same token service.
  const requireAuth = buildRequireAuth(tokenService);

  // ─── HTTP controllers ────────────────────────────────────────────────────
  const deps: ServerDependencies = {
    documents: new DocumentsController(
      uploadDocument,
      createUploadUrl,
      registerUpload,
      getDocument,
      getDocumentFile,
      listDocuments,
      deleteDocument,
      endLessonSession
    ),
    chat: new ChatController(streamChat),
    speech: new SpeechController(synthesizeSpeech),
    transcription: new TranscriptionController(transcribeAudio),
    auth: new AuthController(
      getGoogleAuthUrl,
      authenticateWithGoogle,
      refreshSession,
      getCurrentUser,
      logger
    ),
    requireAuth,
    logger
  };

  return { dataSource, deps };
}
