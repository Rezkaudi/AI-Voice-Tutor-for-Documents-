import type { DocLayoutService } from "ppu-doclayout";

import type { Logger } from "@/domain/services/logger";
import type { LayoutRegion } from "@/domain/logic/pdf/layout-region";

export class DocLayoutRegionDetector {
  private static readonly MIN_SCORE = 0.5;

  private servicePromise: Promise<DocLayoutService> | null = null;

  constructor(private readonly logger: Logger) { }

  /** Detects layout regions in model reading order; returns [] on any failure. */
  async detectRegions(png: ArrayBuffer): Promise<LayoutRegion[]> {
    try {
      const service = await this.service();
      const result = await service.analyze(png);
      return result.boxes
        .filter((box) => box.score >= DocLayoutRegionDetector.MIN_SCORE)
        .map((box) => ({
          label: box.label,
          score: box.score,
          x1: box.box[0],
          y1: box.box[1],
          x2: box.box[2],
          y2: box.box[3]
        }));
    } catch (error) {
      this.logger.scope("doclayout").error("layout analysis failed", error);
      return [];
    }
  }

  private service(): Promise<DocLayoutService> {
    if (!this.servicePromise) {
      this.servicePromise = (async () => {
        const log = this.logger.scope("doclayout");
        log.info("loading PP-DocLayout model (downloaded and cached on first run)");
        const { DocLayoutService: Service } = await import("ppu-doclayout");
        const service = new Service({
          debugging: { debug: false, verbose: false }
        });
        await service.initialize();
        log.info("layout model ready");
        return service;
      })().catch((error) => {
        // Allow a retry on the next request instead of caching the failure.
        this.servicePromise = null;
        throw error;
      });
    }
    return this.servicePromise;
  }
}
