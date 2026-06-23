import type { TFunction } from "i18next";
import type { DocumentSummary } from "@/types";

export function formatMeta(doc: DocumentSummary, t: TFunction): string {
  const parts: string[] = [t("library.page", { count: doc.pageCount })];
  if (doc.fileType) {
    parts.push(doc.fileType.toUpperCase());
  }
  if (doc.updatedAt) {
    const date = new Date(doc.updatedAt);
    if (!Number.isNaN(date.getTime())) {
      parts.push(relativeTime(date, t));
    }
  }
  return parts.join(" · ");
}

function relativeTime(date: Date, t: TFunction): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return t("library.justNow");
  if (minutes < 60) return t("library.minutesAgo", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("library.hoursAgo", { count: hours });
  const days = Math.round(hours / 24);
  if (days < 7) return t("library.daysAgo", { count: days });
  return date.toLocaleDateString();
}
