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
  }
] as const;
