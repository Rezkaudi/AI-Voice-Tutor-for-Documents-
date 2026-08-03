import type { Request, Response } from "express";

import type {
  RunExtractionJobStatus,
  RunExtractionJobUseCase
} from "@/application/use-cases/documents/run-extraction-job.use-case";

const STATUS_CODES: Record<RunExtractionJobStatus, number> = {
  done: 200,
  continued: 200,
  missing: 200,
  busy: 409,
  failed: 500
};

export class InternalController {
  constructor(private readonly runExtractionJob: RunExtractionJobUseCase) { }

  runExtraction = async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.body?.userId ?? "");
    const documentId = String(req.body?.documentId ?? "");
    if (!userId || !documentId) {
      res.status(400).json({ error: "userId and documentId are required." });
      return;
    }

    const result = await this.runExtractionJob.execute({ userId, documentId });

    res.status(STATUS_CODES[result.status]).json(result);
  };
}
