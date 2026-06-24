import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";

interface BackButtonProps {
  isDesktop: boolean;
  onBack: () => void;
}

/** Floating "back to documents" control, shared by both workspace layouts. */
export function BackButton({ isDesktop, onBack }: BackButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={cx(
        "absolute start-4 top-4 z-30 inline-flex h-10 items-center rounded-full text-[0.85rem] font-semibold tracking-[0.01em]",
        "border border-line bg-paper-strong/90 text-ink shadow-app backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]",
        "transition-[transform,background,border-color] duration-200 ease-out",
        "[&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:border-accent/60",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        isDesktop ? "gap-2 px-4" : "w-10 justify-center"
      )}
      aria-label={t("workspace.backToDocuments")}
      title={t("workspace.backToDocuments")}
      onClick={onBack}
    >
      <ArrowLeft size={isDesktop ? 16 : 18} aria-hidden />
    </button>
  );
}
