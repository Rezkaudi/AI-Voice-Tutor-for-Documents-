import type { DocumentSummary } from "@/lib/types";

export function formatMeta(doc: DocumentSummary): string {
  const parts: string[] = [`${doc.pageCount} ${doc.pageCount === 1 ? "page" : "pages"}`];
  if (doc.fileType) {
    parts.push(doc.fileType.toUpperCase());
  }
  if (doc.updatedAt) {
    const date = new Date(doc.updatedAt);
    if (!Number.isNaN(date.getTime())) {
      parts.push(relativeTime(date));
    }
  }
  return parts.join(" · ");
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
