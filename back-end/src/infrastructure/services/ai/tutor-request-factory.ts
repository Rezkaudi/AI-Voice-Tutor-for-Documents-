import type { TutorReplyRequest } from "@/domain/services/tutor-service";
import type { EnvConfig } from "@/config/env.config";
import { buildTutorInstructions, TUTOR_GENERATION, TUTOR_TOOLS } from "./tutor-prompts";

/** Per-turn model/decoding settings, chosen from the save-cost flag. */
export interface TurnSettings {
  model: string;
  historyWindow: number;
  reasoningEffort: string;
}

/**
 * Assembles the OpenAI Responses request payloads for a tutor turn — the model
 * and decoding settings, the first turn's history + message input, and each
 * step's request body. Keeps the wire-format details out of the orchestration
 * loop in {@link OpenAiTutorService}.
 */
export class TutorRequestFactory {
  constructor(private readonly config: EnvConfig) {}

  /** Model, history window, and reasoning effort for this turn. */
  settingsFor(request: TutorReplyRequest): TurnSettings {
    return {
      model: request.saveCost
        ? this.config.OPENAI_TUTOR_MODEL_SAVE_COST
        : this.config.OPENAI_TUTOR_MODEL,
      historyWindow: request.saveCost
        ? TUTOR_GENERATION.historyWindowSaveCost
        : TUTOR_GENERATION.historyWindow,
      reasoningEffort: request.saveCost
        ? TUTOR_GENERATION.reasoningEffortSaveCost
        : TUTOR_GENERATION.reasoningEffort
    };
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
      max_output_tokens: TUTOR_GENERATION.maxOutputTokens,
      tools: TUTOR_TOOLS,
      input,
      ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
      stream: true
    };
  }
}
