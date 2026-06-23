import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx, ui } from "@/lib/uiClasses";

export function ProcessingState({ surfaceClass }: { surfaceClass: string }) {
  const { t } = useTranslation();
  return (
    <div
      className={cx(surfaceClass, "grid min-h-[330px] place-items-center gap-3 text-center")}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={ui.spin} size={42} aria-hidden />
      <h2>{t("upload.processingTitle")}</h2>
      <p>{t("upload.processingBody")}</p>
    </div>
  );
}
