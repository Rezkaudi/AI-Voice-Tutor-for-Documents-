import type { DataSource } from "typeorm";

import { DeleteDocumentUseCase } from "@/application/use-cases/documents/delete-document.use-case";
import { GetDocumentUseCase } from "@/application/use-cases/documents/get-document.use-case";
import { GetDocumentFileUseCase } from "@/application/use-cases/documents/get-document-file.use-case";
import { ListDocumentsUseCase } from "@/application/use-cases/documents/list-documents.use-case";
import { UploadDocumentUseCase } from "@/application/use-cases/documents/upload-document.use-case";
import { StreamChatUseCase } from "@/application/use-cases/chat/stream-chat.use-case";
import { SynthesizeSpeechUseCase } from "@/application/use-cases/speech/synthesize-speech.use-case";
import { TranscribeAudioUseCase } from "@/application/use-cases/transcription/transcribe-audio.use-case";

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

import { S3FileStorage } from "@/infrastructure/services/storage/s3-file-storage";
import { PdfJsTextExtractor } from "@/infrastructure/services/documents/pdfjs-text-extractor";
import { OpenAiTutorService } from "@/infrastructure/services/ai/openai-tutor.service";
import { TutorToolExecutor } from "@/infrastructure/services/ai/tutor-tool-executor";
import { OpenAiEmbeddingService } from "@/infrastructure/services/ai/openai-embedding.service";
import { OpenAiSpeechSynthesisService, OpenAiTranscriptionService } from "@/infrastructure/services/ai/openai-speech.service";
import { ConsoleLogger } from "@/infrastructure/logging/console-logger";

import { DocumentsController } from "@/infrastructure/http/controllers/documents.controller";
import { ChatController } from "@/infrastructure/http/controllers/chat.controller";
import { SpeechController } from "@/infrastructure/http/controllers/speech.controller";
import { TranscriptionController } from "@/infrastructure/http/controllers/transcription.controller";
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
  const documentChunker = new DocumentChunker();
  const uploadValidator = new UploadValidator();
  const fileNaming = new FileNaming();
  const historySanitizer = new ChatHistorySanitizer();

  // ─── Infrastructure adapters (implement domain ports) ────────────────────
  const documentRepository = new TypeOrmDocumentRepository(dataSource);
  const fileStorage = new S3FileStorage(ENV_CONFIG);
  const textExtractor = new PdfJsTextExtractor();
  const embeddingService = new OpenAiEmbeddingService(ENV_CONFIG, logger);
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
    logger
  );
  const speechService = new OpenAiSpeechSynthesisService(ENV_CONFIG);
  const transcriptionService = new OpenAiTranscriptionService(ENV_CONFIG);

  // ─── Application use cases ───────────────────────────────────────────────
  const uploadDocument = new UploadDocumentUseCase(
    documentRepository,
    fileStorage,
    textExtractor,
    embeddingService,
    uploadValidator,
    documentChunker,
    fileNaming,
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
    transcription: new TranscriptionController(transcribeAudio)
  };

  return { dataSource, deps };
}
