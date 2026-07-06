import { Loader2, UploadCloud } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx, ui } from "@/lib/uiClasses";

interface ProcessingStateProps {
  surfaceClass: string;
  progress: number;
  phase: "uploading" | "processing";
}

export function ProcessingState({ surfaceClass, progress, phase }: ProcessingStateProps) {
  const { t } = useTranslation();
  const uploading = phase === "uploading";

  return (
    <div
      className={cx(surfaceClass, "grid min-h-[330px] place-items-center gap-3 text-center")}
      role="status"
      aria-live="polite"
    >
      {uploading ? (
        <UploadCloud size={42} aria-hidden className="text-accent" />
      ) : (
        <Loader2 className={ui.spin} size={42} aria-hidden />
      )}
      <h2>{uploading ? t("upload.uploadingTitle") : t("upload.processingTitle")}</h2>
      <p>{uploading ? t("upload.uploadingBody") : t("upload.processingBody")}</p>

      {uploading ? (
        <div className="w-full max-w-[320px]">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-[0.85rem] font-[650] text-muted">{progress}%</p>
        </div>
      ) : null}
    </div>
  );
}
