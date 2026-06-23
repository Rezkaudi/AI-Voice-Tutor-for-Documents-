import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ui } from "@/lib/uiClasses";

export function LoadingState() {
  const { t } = useTranslation();
  return (
    <div
      className="grid place-items-center gap-2 px-2 py-8 text-muted"
      role="status"
      aria-live="polite"
    >
      <Loader2 className={ui.spin} size={22} aria-hidden />
      <span className="text-[0.86rem]">{t("upload.loadingLibrary")}</span>
    </div>
  );
}
