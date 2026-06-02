/** A pending tool call surfaced by one response step. */
export interface PendingToolCall {
  callId: string;
  name: string;
  args: string;
}

/** What one streamed response step yields once fully consumed. */
export interface StreamStep {
  toolCalls: PendingToolCall[];
  stepText: string;
  responseId?: string;
}

/**
 * Drains one OpenAI Responses streaming step into a {@link StreamStep}.
 *
 * Text is buffered per output item because the model can emit several message
 * items in one response (e.g. an interim restatement plus the final answer);
 * concatenating every delta blindly would double the reply. We keep only the
 * last message item — earlier ones are restatements the final item subsumes.
 */
export class OpenAiResponseStreamReader {
  async read(stream: AsyncIterable<Record<string, unknown>>): Promise<StreamStep> {
    const toolCalls: PendingToolCall[] = [];
    const textByOutputIndex = new Map<number, string>();
    let responseId: string | undefined;

    for await (const event of stream) {
      if (
        event.type === "response.output_text.delta" &&
        typeof event.delta === "string"
      ) {
        const index = typeof event.output_index === "number" ? event.output_index : 0;
        textByOutputIndex.set(index, (textByOutputIndex.get(index) ?? "") + event.delta);
      } else if (event.type === "response.output_item.done") {
        const item = event.item as Record<string, unknown> | undefined;
        if (item?.type === "function_call") {
          toolCalls.push({
            callId: String(item.call_id),
            name: String(item.name),
            args: typeof item.arguments === "string" ? item.arguments : "{}"
          });
        }
      } else if (event.type === "response.completed") {
        const response = event.response as Record<string, unknown> | undefined;
        if (response?.id) {
          responseId = String(response.id);
        }
      }
    }

    const lastIndex = [...textByOutputIndex.keys()].sort((a, b) => a - b).pop();
    const stepText =
      lastIndex === undefined ? "" : (textByOutputIndex.get(lastIndex) ?? "");

    return { toolCalls, stepText, responseId };
  }
}
