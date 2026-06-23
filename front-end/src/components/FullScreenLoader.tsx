import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Centered full-viewport spinner used while auth or a document resolves. */
export function FullScreenLoader({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh place-items-center bg-paper text-muted">
      <Loader2 className="animate-spin-fast" size={28} aria-label={label ?? t("common.loading")} />
    </div>
  );
}
