import { useTranslation } from "react-i18next";

export function EmptyState({ hint }: { hint?: string }) {
  const { t } = useTranslation();
  return (
    <p className="m-0 rounded-lg border border-dashed border-line bg-paper-strong/60 px-3 py-4 text-center text-[0.86rem] text-muted">
      {hint ?? t("library.emptyHint")}
    </p>
  );
}
