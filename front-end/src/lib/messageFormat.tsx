import type { ReactNode } from "react";

/**
 * Strip simple markdown bold/italic markers and split a message into paragraphs
 * for readable rendering in a chat bubble.
 */
export function renderMessageBody(content: string): ReactNode[] {
  const cleaned = content
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\W)\*(.+?)\*(?=\W|$)/g, "$1$2");

  return cleaned
    .split(/\n{2,}/)
    .map((paragraph, index) => <p key={index}>{paragraph}</p>);
}
