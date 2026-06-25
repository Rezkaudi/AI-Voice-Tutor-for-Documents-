import OpenAI from "openai";
import type { EmbeddingService } from "@/domain/services/embedding-service";
import type { Logger } from "@/domain/services/logger";
import type { EnvConfig } from "@/config/env.config";

const BATCH_SIZE = 96;

export class OpenAiEmbeddingService implements EmbeddingService {
  private readonly client: OpenAI;

  constructor(
    private readonly config: EnvConfig,
    private readonly logger: Logger
  ) {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  async embedTexts(texts: string[]): Promise<(number[] | null)[]> {
    if (texts.length === 0) {
      return [];
    }

    const batches: string[][] = [];
    for (let index = 0; index < texts.length; index += BATCH_SIZE) {
      batches.push(texts.slice(index, index + BATCH_SIZE));
    }

    const log = this.logger.scope("embedding");
    log.info(
      `embedding ${texts.length} text(s) in ${batches.length} batch(es) · ` +
      `model=${this.config.OPENAI_EMBEDDING_MODEL}`
    );
    try {
      const responses = await Promise.all(
        batches.map((batch) =>
          this.client.embeddings.create({
            model: this.config.OPENAI_EMBEDDING_MODEL,
            input: batch
          })
        )
      );
      const vectors = responses.flatMap((response) =>
        response.data.map((item) => item.embedding)
      );
      log.info(`embedded ${vectors.length} vector(s)`);
      return vectors;
    } catch (error) {
      log.error("embedding request failed — returning null vectors", error);
      return texts.map(() => null);
    }
  }

  async embedQuery(query: string): Promise<number[] | null> {
    const [embedding] = await this.embedTexts([query]);
    return embedding ?? null;
  }
}
