import type { ReactNode } from "react";

const SNIPPET_MATCH_LENGTH = 140;

/**
 * Strip simple markdown bold/italic markers and split a message into paragraphs
 * for readable rendering in a chat bubble.
 */
export function renderMessageBody(content: string): ReactNode {
  const cleaned = content
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\W)\*(.+?)\*(?=\W|$)/g, "$1$2");

  return cleaned
    .split(/\n{2,}/)
    .map((paragraph, index) => <p key={index}>{paragraph}</p>);
}

/**
 * Render `text` with the first occurrence of `snippet` wrapped in a `<mark>`.
 * Falls back to the plain text when there is no snippet or no match.
 */
export function renderHighlightedText(text: string, snippet: string | null): ReactNode {
  if (!snippet) {
    return text;
  }

  const needle = snippet.replaceAll("...", "").trim().slice(0, SNIPPET_MATCH_LENGTH);
  if (!needle) {
    return text;
  }

  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) {
    return text;
  }

  return (
    <>
      {text.slice(0, index)}
      <mark className="highlight">{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}
