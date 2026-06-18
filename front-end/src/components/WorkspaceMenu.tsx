import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Captions,
  Maximize2,
  Minimize2,
  RotateCcw,
  ScrollText,
  SlidersHorizontal,
  type LucideIcon
} from "lucide-react";
import { cx } from "@/lib/uiClasses";
import { useFullscreen } from "@/lib/useFullscreen";
import { ConfirmDialog } from "./ConfirmDialog";

interface MenuItemProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
}

/** One labelled row in the workspace overflow menu. */
function MenuItem({
  icon: Icon,
  label,
  onClick,
  active = false,
  danger = false,
  disabled = false,
  trailing
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cx(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.85rem] font-semibold transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        danger
          ? "text-danger [&:hover:not(:disabled)]:bg-[oklch(0.94_0.04_28)]"
          : "text-ink [&:hover:not(:disabled)]:bg-[oklch(0.93_0.014_240)]",
        active && !danger && "bg-[oklch(0.95_0.04_154)] text-accent-ink"
      )}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={16} aria-hidden className="flex-none" />
      <span className="flex-1">{label}</span>
      {trailing}
    </button>
  );
}

/** Small On/Off state chip shown on toggle rows. */
function StateChip({ on }: { on: boolean }) {
  return (
    <span
      className={cx(
        "rounded-full px-1.5 py-0.5 text-[0.62rem] font-bold tracking-[0.02em]",
        on ? "bg-accent text-[oklch(0.98_0.01_138)]" : "bg-[oklch(0.88_0.012_240)] text-muted"
      )}
    >
      {on ? "ON" : "OFF"}
    </span>
  );
}

interface WorkspaceMenuProps {
  showTranscript: boolean;
  showCaption: boolean;
  restartDisabled: boolean;
  onEditPages?: () => void;
  onToggleTranscript: () => void;
  onToggleCaption: () => void;
  onRestart: () => void;
}

/**
 * Single overflow control for the document workspace. Collapses every
 * secondary action — Teaching pages, fullscreen, transcript, captions, and
 * restart — into one mobile-style dropdown so the document stays uncluttered.
 */
export function WorkspaceMenu({
  showTranscript,
  showCaption,
  restartDisabled,
  onEditPages,
  onToggleTranscript,
  onToggleCaption,
  onRestart
}: WorkspaceMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  // Dismiss on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="absolute right-4 top-4 z-30">
      {open ? (
        <div
          role="menu"
          aria-label="Lesson controls"
          className="absolute right-0 top-12 w-60 origin-top-right rounded-xl border border-line bg-paper-strong p-1.5 shadow-app animate-modal-pop"
        >
          {onEditPages ? (
            <MenuItem icon={BookOpen} label="Teaching pages" onClick={() => run(onEditPages)} />
          ) : null}
          <MenuItem
            icon={isFullscreen ? Minimize2 : Maximize2}
            label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            active={isFullscreen}
            onClick={() => run(toggleFullscreen)}
          />
          <MenuItem
            icon={ScrollText}
            label="Transcript"
            active={showTranscript}
            trailing={<StateChip on={showTranscript} />}
            onClick={() => run(onToggleTranscript)}
          />
          <MenuItem
            icon={Captions}
            label="Captions"
            active={showCaption}
            trailing={<StateChip on={showCaption} />}
            onClick={() => run(onToggleCaption)}
          />
          <div className="my-1 h-px bg-line" />
          <MenuItem
            icon={RotateCcw}
            label="Restart lesson"
            danger
            disabled={restartDisabled}
            onClick={() => {
              setOpen(false);
              setConfirmOpen(true);
            }}
          />
        </div>
      ) : null}

      <button
        type="button"
        className={cx(
          "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[0.85rem] font-semibold tracking-[0.01em]",
          "shadow-[0_8px_22px_oklch(0.08_0.02_245/0.45)] backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]",
          "transition-[transform,background,border-color] duration-200 ease-out",
          "[&:hover:not(:disabled)]:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.78_0.13_165)]",
          open
            ? "border border-transparent bg-[oklch(0.82_0.13_165)] text-[oklch(0.18_0.04_230)]"
            : "border border-[oklch(1_0_0/0.22)] bg-[oklch(0.17_0.025_244/0.78)] text-[oklch(0.97_0.01_215)] [&:hover:not(:disabled)]:border-[oklch(0.78_0.13_165/0.7)] [&:hover:not(:disabled)]:bg-[oklch(0.22_0.03_244/0.88)]"
        )}
        aria-label="Lesson controls menu"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Lesson controls"
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal size={16} aria-hidden />
        <span>Menu</span>
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Restart the lesson?"
        body="This clears the current chat and starts a fresh session from the beginning. This action cannot be undone."
        confirmLabel="Clear & restart"
        cancelLabel="Cancel"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onRestart();
        }}
      />
    </div>
  );
}
