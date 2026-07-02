import { FileText, Phone, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MobilePane } from "@/types";
import { useSessionStore } from "@/store/sessionStore";
import { nav, tab } from "@/styles/components/workspace/mobilePaneTabs";

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
      className={tab}
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
    <nav className={nav} role="tablist" aria-label={t("workspace.switchView")}>
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
