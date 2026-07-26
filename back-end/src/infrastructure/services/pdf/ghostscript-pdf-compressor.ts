import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { PdfPageCounter } from "@/domain/services/pdf-page-counter";
import type { Logger } from "@/domain/services/logger";
import type {
  PdfCompressionResult,
  PdfCompressor
} from "@/domain/services/pdf-compressor";

const execFileAsync = promisify(execFile);

export interface GhostscriptOptions {
  readonly enabled: boolean;
  readonly minBytes: number;
  readonly preset: string;
  readonly minGain: number;
  readonly timeoutMs: number;
}

export class GhostscriptPdfCompressor implements PdfCompressor {
  private binaryMissing = false;

  constructor(
    private readonly pageCounter: PdfPageCounter,
    private readonly logger: Logger,
    private readonly options: GhostscriptOptions
  ) { }

  async compress(source: Buffer): Promise<PdfCompressionResult> {
    const log = this.logger.scope("pdf-compress");
    const bytesBefore = source.byteLength;
    const keepOriginal = (
      skippedReason: PdfCompressionResult["skippedReason"]
    ): PdfCompressionResult => ({
      body: source,
      compressed: false,
      bytesBefore,
      bytesAfter: bytesBefore,
      skippedReason
    });

    if (!this.options.enabled || this.binaryMissing) {
      return keepOriginal("disabled");
    }

    if (bytesBefore < this.options.minBytes) {
      return keepOriginal("below-threshold");
    }

    const workDir = await mkdtemp(join(tmpdir(), "pdfmin-"));
    const inputPath = join(workDir, `${randomUUID()}.pdf`);
    const outputPath = join(workDir, `${randomUUID()}.min.pdf`);

    try {
      await writeFile(inputPath, source);

      const startedAt = Date.now();
      await execFileAsync("gs", this.buildArgs(inputPath, outputPath), {
        timeout: this.options.timeoutMs,
        // Ghostscript chatters on stdout; keep the buffer generous so a noisy
        // run is never mistaken for a failure.
        maxBuffer: 8 * 1024 * 1024
      });
      const elapsedMs = Date.now() - startedAt;

      const { size: bytesAfter } = await stat(outputPath);
      const gain = 1 - bytesAfter / bytesBefore;

      if (gain < this.options.minGain) {
        log.info(
          `kept original — ${formatMb(bytesBefore)} → ${formatMb(bytesAfter)} ` +
          `(${formatPercent(gain)} gain, below ${formatPercent(this.options.minGain)})`
        );
        return keepOriginal("no-gain");
      }

      const compressedBody = await readFile(outputPath);

      // A preset that silently dropped pages would quietly break every
      // citation into the missing range, so this is a hard gate.
      const pagesBefore = await this.pageCounter.countPages(source);
      const pagesAfter = await this.pageCounter.countPages(compressedBody);
      if (pagesBefore !== pagesAfter) {
        log.warn(
          `discarded compressed copy — page count changed ` +
          `${pagesBefore} → ${pagesAfter}`
        );
        return keepOriginal("page-count-changed");
      }

      log.info(
        `compressed ${formatMb(bytesBefore)} → ${formatMb(bytesAfter)} ` +
        `(−${formatPercent(gain)}, ${pagesAfter} pages, ${(elapsedMs / 1000).toFixed(1)}s)`
      );

      return {
        body: compressedBody,
        compressed: true,
        bytesBefore,
        bytesAfter
      };
    } catch (error) {
      this.noteFailure(error, log);
      return keepOriginal("failed");
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private buildArgs(inputPath: string, outputPath: string): string[] {
    return [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=/${this.options.preset}`,
      "-dNOPAUSE",
      "-dBATCH",
      "-dQUIET",
      "-dSAFER",
      "-dAutoRotatePages=/None",
      "-dPrinted=false",
      `-sOutputFile=${outputPath}`,
      inputPath
    ];
  }

  /** Distinguishes "no Ghostscript installed" from a per-file failure. */
  private noteFailure(error: unknown, log: ReturnType<Logger["scope"]>): void {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      this.binaryMissing = true;
      log.warn(
        "ghostscript (gs) not found — storing originals. " +
        "Install it in the runtime image to enable compression."
      );
      return;
    }
    const reason = code === "ETIMEDOUT" ? "timed out" : "failed";
    log.warn(`compression ${reason} — storing the original file`);
  }
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
