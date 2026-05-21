import { memo, useEffect, useState, type KeyboardEvent } from "react";
import { cx } from "@/lib/uiClasses";

const MIN_SPLIT = 25;
const MAX_SPLIT = 85;
const DEFAULT_SPLIT = 60;
const KEYBOARD_STEP = 2;
const MIN_CHAT_WIDTH = 400;

function workspaceEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-workspace]");
}

function applySplit(percent: number): void {
  const workspace = workspaceEl();
  if (!workspace) return;
  // Cap the split so the chat pane never shrinks below MIN_CHAT_WIDTH.
  const width = workspace.getBoundingClientRect().width;
  const maxSplit =
    width > 0 ? Math.min(MAX_SPLIT, (1 - MIN_CHAT_WIDTH / width) * 100) : MAX_SPLIT;
  const clamped = Math.min(maxSplit, Math.max(MIN_SPLIT, percent));
  workspace.style.setProperty("--split", `${clamped.toFixed(2)}%`);
}

/** Draggable divider that controls the document / teacher pane ratio. */
function SplitterComponent() {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;

    const setSplitFromX = (clientX: number) => {
      const workspace = workspaceEl();
      if (!workspace) return;
      const rect = workspace.getBoundingClientRect();
      applySplit(((clientX - rect.left) / rect.width) * 100);
    };

    const onMouseMove = (event: MouseEvent) => {
      event.preventDefault();
      setSplitFromX(event.clientX);
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) setSplitFromX(touch.clientX);
    };
    const stop = () => setDragging(false);

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stop);
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", stop);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", stop);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const workspace = workspaceEl();
    if (!workspace) return;
    const current = parseFloat(
      getComputedStyle(workspace).getPropertyValue("--split") || String(DEFAULT_SPLIT)
    );
    if (event.key === "ArrowLeft") {
      applySplit(current - KEYBOARD_STEP);
    } else if (event.key === "ArrowRight") {
      applySplit(current + KEYBOARD_STEP);
    }
  };

  return (
    <div
      className={cx(
        "group relative flex cursor-col-resize touch-none items-center justify-center bg-line transition-[background] duration-140 ease-out before:absolute before:inset-y-0 before:-inset-x-2 before:content-[''] hover:bg-accent focus-visible:bg-accent focus-visible:outline-none max-[920px]:hidden",
        dragging && "bg-accent"
      )}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize document and chat panes"
      aria-valuemin={MIN_SPLIT}
      aria-valuemax={MAX_SPLIT}
      tabIndex={0}
      onMouseDown={() => setDragging(true)}
      onTouchStart={() => setDragging(true)}
      onDoubleClick={() => workspaceEl()?.style.removeProperty("--split")}
      onKeyDown={onKeyDown}
    >
      <span
        className={cx(
          "h-9 w-[3px] rounded-full bg-[oklch(0.55_0.02_240/0.6)] shadow-[-5px_0_0_oklch(0.55_0.02_240/0.4),5px_0_0_oklch(0.55_0.02_240/0.4)] group-hover:bg-white group-hover:shadow-[-5px_0_0_white,5px_0_0_white] group-focus-visible:bg-white group-focus-visible:shadow-[-5px_0_0_white,5px_0_0_white]",
          dragging && "bg-white shadow-[-5px_0_0_white,5px_0_0_white]"
        )}
        aria-hidden
      />
    </div>
  );
}

export const Splitter = memo(SplitterComponent);
