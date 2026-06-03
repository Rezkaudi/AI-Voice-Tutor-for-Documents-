import type { TutorReplyRequest } from "@/domain/services/tutor-service";
import type { EnvConfig } from "@/config/env.config";
import { buildTutorInstructions } from "@/config/prompt.config";
import { NORMAL_GENERATION, SAVE_COST_GENERATION } from "@/config/constant.config";
import { TUTOR_TOOLS } from "@/config/ai-tools.config";

/** Per-turn model/decoding settings, chosen from the save-cost flag. */
export interface TurnSettings {
  model: string;
  historyWindow: number;
  reasoningEffort: string;
  maxOutputTokens: number;
  maxToolSteps: number;
}

/**
 * Assembles the OpenAI Responses request payloads for a tutor turn — the model
 * and decoding settings, the first turn's history + message input, and each
 * step's request body. Keeps the wire-format details out of the orchestration
 * loop in {@link OpenAiTutorService}.
 */
export class TutorRequestFactory {
  constructor(private readonly config: EnvConfig) {}

  /** Model plus every per-turn tuning value for this turn. */
  settingsFor(request: TutorReplyRequest): TurnSettings {
    const profile = request.saveCost ? SAVE_COST_GENERATION : NORMAL_GENERATION;
    const model = request.saveCost
      ? this.config.OPENAI_TUTOR_MODEL_SAVE_COST
      : this.config.OPENAI_TUTOR_MODEL;
    return { model, ...profile };
  }

  /** First-turn input: a slice of history plus the student's message. */
  initialInput(
    request: TutorReplyRequest,
    settings: TurnSettings
  ): Record<string, unknown>[] {
    return [
      ...request.history.slice(-settings.historyWindow).map((message) => ({
        role: message.role,
        content: message.content
      })),
      { role: "user", content: request.message }
    ];
  }

  /** The streaming request body for one step of the agentic loop. */
  body(
    request: TutorReplyRequest,
    settings: TurnSettings,
    input: Record<string, unknown>[],
    previousResponseId: string | undefined
  ): Record<string, unknown> {
    return {
      model: settings.model,
      instructions: buildTutorInstructions(
        request.document.title,
        request.language || undefined
      ),
      reasoning: { effort: settings.reasoningEffort },
      max_output_tokens: settings.maxOutputTokens,
      tools: TUTOR_TOOLS,
      input,
      ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
      stream: true
    };
  }
}
