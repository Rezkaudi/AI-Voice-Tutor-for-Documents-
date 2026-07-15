import type { TutorReplyRequest } from "@/domain/services/tutor-service";
import type { EnvConfig } from "@/config/env.config";
import { buildTutorInstructions } from "@/config/prompt.config";
import { NORMAL_GENERATION } from "@/config/constant.config";

export interface TurnSettings {
  model: string;
  historyWindow: number;
  reasoningEffort: string;
  maxOutputTokens: number;
}

export class TutorRequestFactory {
  constructor(private readonly config: EnvConfig) { }

  settingsFor(_request: TutorReplyRequest): TurnSettings {
    return { model: this.config.OPENAI_TUTOR_MODEL, ...NORMAL_GENERATION };
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

  body(
    settings: TurnSettings,
    input: Record<string, unknown>[],
    request: TutorReplyRequest
  ): Record<string, unknown> {
    return {
      model: settings.model,
      instructions: buildTutorInstructions({ allowAsking: request.allowAsking }),
      reasoning: { effort: settings.reasoningEffort },
      max_output_tokens: settings.maxOutputTokens,
      input,
      stream: true
    };
  }
}
