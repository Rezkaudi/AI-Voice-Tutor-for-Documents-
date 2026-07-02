import { useEffect } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import type { ChatMessage } from "@/types";
import {
  aside,
  asideClosed,
  asideOpen,
  body,
  closeButton,
  header,
  overlayBase,
  overlayClosed,
  overlayOpen,
  title
} from "@/styles/components/workspace/teacher/transcriptDrawer";
import { TranscriptLog } from "./TeacherPanel/TranscriptLog";

interface TranscriptDrawerProps {
  open: boolean;
  messages: ChatMessage[];
  onClose: () => void;
}

export function TranscriptDrawer({ open, messages, onClose }: TranscriptDrawerProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>

      <div
        className={cx(overlayBase, open ? overlayOpen : overlayClosed)}
        aria-hidden
        onClick={onClose}
      />
      <aside
        className={cx(aside, open ? asideOpen : asideClosed)}
        role="dialog"
        aria-modal="false"
        aria-label={t("transcriptDrawer.aria")}
        aria-hidden={!open}
      >
        <header className={header}>
          <h2 className={title}>{t("transcriptDrawer.title")}</h2>
          <button
            type="button"
            className={closeButton}
            aria-label={t("transcriptDrawer.close")}
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className={body}>
          <TranscriptLog messages={messages} />
        </div>
      </aside>
    </>
  );
}
