import OpenAI from "openai";
import type { EmbeddingService } from "@/domain/services/embedding-service";
import type { EnvConfig } from "@/config/env.config";
import { logger } from "@/shared/logger";

/** OpenAI batch size — the embeddings endpoint accepts up to ~2048 inputs. */
const BATCH_SIZE = 96;

/**
 * `EmbeddingService` backed by OpenAI. Used to vectorise document chunks (the
 * background upload job) and learner queries (the `search_document` tool).
 */
export class OpenAiEmbeddingService implements EmbeddingService {
  private readonly client: OpenAI;

  constructor(private readonly config: EnvConfig) {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  async embedTexts(texts: string[]): Promise<(number[] | null)[]> {
    if (texts.length === 0) {
      return [];
    }

    // Split into API-sized batches and run them concurrently.
    const batches: string[][] = [];
    for (let index = 0; index < texts.length; index += BATCH_SIZE) {
      batches.push(texts.slice(index, index + BATCH_SIZE));
    }

    try {
      const responses = await Promise.all(
        batches.map((batch) =>
          this.client.embeddings.create({
            model: this.config.OPENAI_EMBEDDING_MODEL,
            input: batch
          })
        )
      );
      return responses.flatMap((response) =>
        response.data.map((item) => item.embedding)
      );
    } catch (error) {
      logger.error("Embedding request failed", error);
      return texts.map(() => null);
    }
  }

  async embedQuery(query: string): Promise<number[] | null> {
    const [embedding] = await this.embedTexts([query]);
    return embedding ?? null;
  }
}
