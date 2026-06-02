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
import { DocumentChunker } from "@/domain/logic/document-chunker";
import { UploadValidator } from "@/domain/logic/upload-validator";
import { FileNaming } from "@/domain/logic/file-naming";
import { ChatHistorySanitizer } from "@/domain/logic/chat-history-sanitizer";

import { initializeDatabase } from "@/infrastructure/database/data-source";
import { TypeOrmDocumentRepository } from "@/infrastructure/database/repositories/typeorm-document.repository";

import { S3FileStorage } from "@/infrastructure/services/storage/s3-file-storage";
import { PdfJsTextExtractor } from "@/infrastructure/services/documents/pdfjs-text-extractor";
import { OpenAiTutorService } from "@/infrastructure/services/ai/openai-tutor.service";
import { OpenAiEmbeddingService } from "@/infrastructure/services/ai/openai-embedding.service";
import { OpenAiSpeechSynthesisService, OpenAiTranscriptionService } from "@/infrastructure/services/ai/openai-speech.service";

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
  // ─── Persistence ─────────────────────────────────────────────────────────
  const dataSource = await initializeDatabase();

  // ─── Domain services (pure business logic) ───────────────────────────────
  const tokenizer = new TextTokenizer();
  const chunkRanker = new ChunkRanker(tokenizer);
  const citationResolver = new CitationResolver(tokenizer);
  const documentChunker = new DocumentChunker();
  const uploadValidator = new UploadValidator();
  const fileNaming = new FileNaming();
  const historySanitizer = new ChatHistorySanitizer();

  // ─── Infrastructure adapters (implement domain ports) ────────────────────
  const documentRepository = new TypeOrmDocumentRepository(dataSource);
  const fileStorage = new S3FileStorage(ENV_CONFIG);
  const textExtractor = new PdfJsTextExtractor();
  const embeddingService = new OpenAiEmbeddingService(ENV_CONFIG);
  const tutorService = new OpenAiTutorService(
    ENV_CONFIG,
    embeddingService,
    chunkRanker,
    citationResolver
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
    fileNaming
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
    historySanitizer
  );
  const synthesizeSpeech = new SynthesizeSpeechUseCase(speechService);
  const transcribeAudio = new TranscribeAudioUseCase(transcriptionService);

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
