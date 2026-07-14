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
  }
] as const;
