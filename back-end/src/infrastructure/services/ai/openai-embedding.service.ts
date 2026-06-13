import OpenAI from "openai";
import type { EmbeddingService } from "@/domain/services/embedding-service";
import type { Logger } from "@/domain/services/logger";
import type { EnvConfig } from "@/config/env.config";
import type { CostCalculator } from "@/domain/logic/cost/cost-calculator";
import type { CostReporter } from "@/domain/services/cost-reporter";

/** OpenAI batch size — the embeddings endpoint accepts up to ~2048 inputs. */
const BATCH_SIZE = 96;

/**
 * `EmbeddingService` backed by OpenAI. Used to vectorise document chunks (the
 * background upload job) and learner queries (the `search_document` tool).
 */
export class OpenAiEmbeddingService implements EmbeddingService {
  private readonly client: OpenAI;

  constructor(
    private readonly config: EnvConfig,
    private readonly logger: Logger,
    private readonly costCalculator: CostCalculator,
    private readonly costReporter: CostReporter
  ) {
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
      const billedTokens = responses.reduce(
        (sum, response) => sum + (response.usage?.total_tokens ?? 0),
        0
      );
      if (billedTokens > 0) {
        const model = this.config.OPENAI_EMBEDDING_MODEL;
        this.costReporter.report({
          operation: "embedding",
          cost: this.costCalculator.embedding(model, billedTokens),
          context: `${texts.length} text(s)`,
          meta: { tokens: billedTokens }
        });
      }
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
