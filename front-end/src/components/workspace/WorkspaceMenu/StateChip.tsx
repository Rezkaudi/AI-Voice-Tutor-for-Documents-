import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";

/** Small On/Off state chip shown on toggle rows. */
export function StateChip({ on }: { on: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={cx(
        "rounded-full px-1.5 py-0.5 text-[0.62rem] font-bold tracking-[0.02em]",
        on ? "bg-accent text-[oklch(0.98_0.01_138)]" : "bg-[oklch(0.88_0.012_240)] text-muted"
      )}
    >
      {on ? t("common.on") : t("common.off")}
    </span>
  );
}
