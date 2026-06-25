import type { TutorReplyRequest } from "@/domain/services/tutor-service";
import type { EnvConfig } from "@/config/env.config";
import { buildTutorInstructions } from "@/config/prompt.config";
import { NORMAL_GENERATION, SAVE_COST_GENERATION } from "@/config/constant.config";
import { TUTOR_TOOLS } from "@/config/ai-tools.config";

export interface TurnSettings {
  model: string;
  historyWindow: number;
  reasoningEffort: string;
  maxOutputTokens: number;
  maxToolSteps: number;
}

export class TutorRequestFactory {
  constructor(private readonly config: EnvConfig) { }

  settingsFor(request: TutorReplyRequest): TurnSettings {
    const profile = request.saveCost ? SAVE_COST_GENERATION : NORMAL_GENERATION;
    const model = request.saveCost
      ? this.config.OPENAI_TUTOR_MODEL_SAVE_COST
      : this.config.OPENAI_TUTOR_MODEL;
    return { model, ...profile };
  }

  initialInput(request: TutorReplyRequest, settings: TurnSettings): Record<string, unknown>[] {
    const lessonMaterial = this.lessonMaterial(request);
    return [
      ...(lessonMaterial ? [{ role: "developer", content: lessonMaterial }] : []),
      ...request.history.slice(-settings.historyWindow).map((message) => ({
        role: message.role,
        content: message.content
      })),
      { role: "user", content: request.message }
    ];
  }

  private lessonMaterial(request: TutorReplyRequest): string {
    if (request.selectedPages.length === 0) return "";
    const ordered = [...request.selectedPages].sort((a, b) => a - b);
    const byNumber = new Map(request.pages.map((page) => [page.pageNumber, page]));
    const sections = ordered
      .map((pageNumber) => {
        const page = byNumber.get(pageNumber);
        if (!page) return "";
        return `===== PAGE ${pageNumber} =====\n${page.text}`;
      })
      .filter(Boolean);
    if (sections.length === 0) return "";
    return (
      "LESSON MATERIAL — the full text of the pages the student chose to study " +
      "this lesson, in teaching order. Teach the lesson from these pages, " +
      "page by page, one idea at a time.\n\n" +
      sections.join("\n\n")
    );
  }

  body(request: TutorReplyRequest, settings: TurnSettings, input: Record<string, unknown>[], previousResponseId: string | undefined): Record<string, unknown> {
    return {
      model: settings.model,
      instructions: buildTutorInstructions(),
      reasoning: { effort: settings.reasoningEffort },
      max_output_tokens: settings.maxOutputTokens,
      tools: this.toolsFor(request),
      input,
      ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
      stream: true
    };
  }

  private toolsFor(request: TutorReplyRequest): readonly unknown[] {
    if (request.selectedPages.length === 0) return TUTOR_TOOLS;
    return [];
  }
}
