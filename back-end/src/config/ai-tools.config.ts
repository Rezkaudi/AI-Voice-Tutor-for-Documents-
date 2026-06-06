/**
 * Tools the tutor calls to read the document on demand. Shape matches the
 * OpenAI Responses API (flat function tools).
 */
export const TUTOR_TOOLS = [
  {
    type: "function",
    name: "get_page",
    description:
      "Read the full text of one page by its number. Use it for positional " +
      "questions ('the first page', 'page 3', 'the last page') or to study a " +
      "specific page in depth.",
    parameters: {
      type: "object",
      properties: {
        page: { type: "integer", description: "1-based page number to read." }
      },
      required: ["page"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "search_document",
    description:
      "Search the whole document for passages relevant to a topic or question. " +
      "Returns the best-matching passages with their page numbers. Use it whenever " +
      "the student asks about a concept and you do not already know which page covers it.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for, in a few words." }
      },
      required: ["query"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "cite_passages",
    description:
      "Record the verbatim passages from the document that ground your next " +
      "spoken reply. Call this once, right before you produce that reply. Each " +
      "quote MUST be an exact substring of the page text returned by the other " +
      "tools — never paraphrase, never invent. Keep each quote short (one or " +
      "two sentences) and include only the minimal supporting text. Provide " +
      "one citation for every passage your answer leans on — list ALL of them, " +
      "across as many pages as needed. Omit the call only when no quote " +
      "supports what you are about to say.",
    parameters: {
      type: "object",
      properties: {
        citations: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              page: {
                type: "integer",
                description: "1-based page number the quote was taken from."
              },
              quote: {
                type: "string",
                description:
                  "A short verbatim substring of that page — never paraphrased."
              }
            },
            required: ["page", "quote"],
            additionalProperties: false
          }
        }
      },
      required: ["citations"],
      additionalProperties: false
    },
    strict: true
  }
] as const;
