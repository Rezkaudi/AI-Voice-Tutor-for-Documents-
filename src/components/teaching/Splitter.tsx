import { memo, useEffect, useState } from "react";

const MIN_SPLIT = 25;
const MAX_SPLIT = 85;
const DEFAULT_SPLIT = 60;
const KEYBOARD_STEP = 2;

function workspaceEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".workspace");
}

function applySplit(percent: number): void {
  const clamped = Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, percent));
  workspaceEl()?.style.setProperty("--split", `${clamped.toFixed(2)}%`);
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

  const onKeyDown = (event: React.KeyboardEvent) => {
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
      className={`splitter${dragging ? " is-dragging" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize document and chat panes"
      tabIndex={0}
      onMouseDown={() => setDragging(true)}
      onTouchStart={() => setDragging(true)}
      onDoubleClick={() => workspaceEl()?.style.removeProperty("--split")}
      onKeyDown={onKeyDown}
    >
      <span className="splitter-grip" aria-hidden />
    </div>
  );
}

export const Splitter = memo(SplitterComponent);
