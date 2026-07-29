import type { Request, Response } from "express";

import type { RunExtractionJobUseCase } from "@/application/use-cases/documents/run-extraction-job.use-case";

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

    res.status(result.status === "failed" ? 500 : 200).json(result);
  };
}
