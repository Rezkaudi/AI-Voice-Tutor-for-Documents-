import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx, ui } from "@/lib/uiClasses";
import { readyFill, readyRow, readyTrack } from "@/styles/components/workspace/teacher/pageSelectionDialog";

interface ExtractionProgressRowProps {
  readyCount: number;
  pageCount: number;
}

export function ExtractionProgressRow({ readyCount, pageCount }: ExtractionProgressRowProps) {
  const { t } = useTranslation();
  const percent = pageCount > 0 ? (readyCount / pageCount) * 100 : 0;

  return (
    <div className={readyRow} aria-live="polite">
      <Loader2
        size={13}
        className={cx(ui.spin, "shrink-0 text-accent")}
        data-extraction-spinner
        aria-hidden
      />
      <span className="shrink-0">
        {t("dialogs.pages.ready", { ready: readyCount, total: pageCount })}
      </span>
      <div className={readyTrack} aria-hidden>
        <div className={readyFill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
