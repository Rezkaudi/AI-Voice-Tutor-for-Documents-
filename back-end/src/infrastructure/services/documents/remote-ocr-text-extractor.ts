import type { EnvConfig } from "@/config/env.config";
import type { DocumentPage } from "@/domain/entities/document";
import type {
  DocumentTextExtractor,
  ExtractPagesOptions
} from "@/domain/services/document-text-extractor";
import type { Logger } from "@/domain/services/logger";

interface RemotePage {
  page_number: number;
  text: string;
}
interface ExtractResponse {
  pages: RemotePage[];
}
interface DetectModelResponse {
  model?: string;
}

/**
 * Statuses that mean "the OCR fleet is saturated, come back shortly" rather
 * than "this page cannot be read". Retrying these in-place matters: without it
 * a transient 429 propagates up as a page failure and burns one of the page's
 * MAX_PAGE_EXTRACTION_ATTEMPTS, so a busy minute can permanently mark readable
 * pages as exhausted.
 *
 * 500 is deliberately absent: that is the service reporting it processed the
 * page and threw, which repeats deterministically. Only infrastructure-level
 * statuses are worth another attempt.
 */
const RETRYABLE_STATUSES = new Set([408, 425, 429, 502, 503, 504]);

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

class OcrRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
    readonly retryAfterMs: number | null
  ) {
    super(message);
    this.name = "OcrRequestError";
  }
}

export class RemoteOcrTextExtractor implements DocumentTextExtractor {
  constructor(
    private readonly config: EnvConfig,
    private readonly logger: Logger
  ) { }

  /**
   * Recognises `pageNumbers` in a single round trip. The OCR service renders
   * and recognises each page exactly as it does for a one-page request, so the
   * text is byte-identical to sending them separately — batching only
   * amortises the PDF fetch and parse.
   */
  async extractPages(
    pdfUrl: string,
    pageNumbers: number[],
    options?: ExtractPagesOptions
  ): Promise<DocumentPage[]> {
    if (pageNumbers.length === 0) return [];

    const started = Date.now();
    const body: Record<string, unknown> = { url: pdfUrl, pages: pageNumbers };
    if (options?.model) body.model = options.model;

    const result = await this.call<ExtractResponse>("/extract-pages", body, options?.signal);
    const pages = result.pages ?? [];

    this.logger
      .scope("remote-ocr")
      .info(
        `extracted ${pages.length}/${pageNumbers.length} page(s) via s3-url in ` +
        `${Date.now() - started}ms (model=${options?.model ?? "auto"})`
      );

    return pages
      .map((page) => ({ pageNumber: page.page_number, text: page.text }))
      .sort((a, b) => a.pageNumber - b.pageNumber);
  }

  /**
   * Runs the service's own script probe once. Returns null when the service is
   * older than this endpoint, in which case callers omit the model and the
   * service falls back to detecting per request — the previous behaviour.
   */
  async resolveModel(pdfUrl: string, signal?: AbortSignal): Promise<string | null> {
    try {
      const result = await this.call<DetectModelResponse>(
        "/detect-model",
        { url: pdfUrl },
        signal
      );
      return result.model ?? null;
    } catch (error) {
      this.logger
        .scope("remote-ocr")
        .warn("model detection unavailable — falling back to per-request detection", error);
      return null;
    }
  }

  private async call<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const attempts = Math.max(1, this.config.OCR_SERVICE_MAX_ATTEMPTS);
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (signal?.aborted) throw new Error("Extraction aborted.");
      try {
        return await this.callOnce<T>(path, body, signal);
      } catch (error) {
        lastError = error;
        const retryable = error instanceof OcrRequestError && error.retryable;
        if (!retryable || attempt === attempts || signal?.aborted) break;

        const delay = this.backoffMs(attempt, (error as OcrRequestError).retryAfterMs);
        this.logger
          .scope("remote-ocr")
          .info(
            `${path} → ${(error as OcrRequestError).status ?? "network error"} · ` +
            `backing off ${delay}ms (attempt ${attempt}/${attempts})`
          );
        await sleep(delay, signal);
      }
    }
    throw lastError;
  }

  private async callOnce<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error("OCR request timed out.")),
      this.config.OCR_SERVICE_TIMEOUT_MS
    );
    const unlink = link(signal, controller);

    try {
      const response = await fetch(`${this.config.OCR_SERVICE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => "")).slice(0, 300);
        throw new OcrRequestError(
          `OCR function ${path} → ${response.status} ${detail}`,
          response.status,
          RETRYABLE_STATUSES.has(response.status),
          retryAfterMs(response.headers.get("retry-after"))
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof OcrRequestError) throw error;
      // The caller's signal firing is a real cancellation; anything else
      // (socket reset, DNS blip, our own timeout) is worth another attempt.
      if (signal?.aborted) throw error;
      throw new OcrRequestError(
        `OCR function ${path} → ${(error as Error)?.message ?? "network error"}`,
        null,
        true,
        null
      );
    } finally {
      clearTimeout(timeout);
      unlink();
    }
  }

  private backoffMs(attempt: number, retryAfter: number | null): number {
    if (retryAfter !== null) return Math.min(MAX_BACKOFF_MS, retryAfter);
    const exponential = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1));
    // Full jitter keeps a saturated fleet from being hit by a synchronised
    // retry wave from every worker that failed in the same instant.
    return Math.floor(exponential / 2 + Math.random() * (exponential / 2));
  }
}

function retryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

function link(signal: AbortSignal | undefined, controller: AbortController): () => void {
  if (!signal) return () => undefined;
  if (signal.aborted) {
    controller.abort(signal.reason);
    return () => undefined;
  }
  const onAbort = (): void => controller.abort(signal.reason);
  signal.addEventListener("abort", onAbort, { once: true });
  return () => signal.removeEventListener("abort", onAbort);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done(): void {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}
