import { FileText, Phone, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MobilePane } from "@/types";
import { useSessionStore } from "@/store/sessionStore";

const tabClass =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-[7px] rounded-lg border border-line bg-panel text-[0.9rem] font-[650] text-muted transition-[background,color,border-color] duration-140 ease-out aria-selected:border-teacher aria-selected:bg-teacher aria-selected:text-paper-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface PaneTabProps {
  pane: MobilePane;
  label: string;
  icon: LucideIcon;
  selected: boolean;
  onSelect: (pane: MobilePane) => void;
}

function PaneTab({ pane, label, icon: Icon, selected, onSelect }: PaneTabProps) {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${pane}`}
      aria-selected={selected}
      aria-controls={`pane-${pane}`}
      className={tabClass}
      onClick={() => onSelect(pane)}
    >
      <Icon size={16} aria-hidden />
      {label}
    </button>
  );
}

export function MobilePaneTabs() {
  const { t } = useTranslation();
  const mobilePane = useSessionStore((s) => s.mobilePane);
  const setMobilePane = useSessionStore((s) => s.setMobilePane);

  return (
    <nav
      className="hidden gap-1.5 border-b border-line bg-paper-strong px-[clamp(12px,3vw,20px)] py-2 max-[920px]:flex"
      role="tablist"
      aria-label={t("workspace.switchView")}
    >
      <PaneTab
        pane="document"
        label={t("workspace.tabDocument")}
        icon={FileText}
        selected={mobilePane === "document"}
        onSelect={setMobilePane}
      />
      <PaneTab
        pane="teacher"
        label={t("workspace.tabTeacher")}
        icon={Phone}
        selected={mobilePane === "teacher"}
        onSelect={setMobilePane}
      />
    </nav>
  );
}
