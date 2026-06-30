import { useCallback, useEffect, useRef, useState } from "react";

export interface Point {
  x: number;
  y: number;
}

const DRAG_THRESHOLD = 6;
const EDGE_GAP = 10;

interface DragSession {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

export function useDraggable(storageKey: string, fallback: () => Point) {
  const ref = useRef<HTMLElement>(null);
  const session = useRef<DragSession | null>(null);
  const [pos, setPos] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);

  const clamp = useCallback((point: Point): Point => {
    const el = ref.current;
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    const maxX = Math.max(EDGE_GAP, window.innerWidth - w - EDGE_GAP);
    const maxY = Math.max(EDGE_GAP, window.innerHeight - h - EDGE_GAP);
    return {
      x: Math.min(Math.max(EDGE_GAP, point.x), maxX),
      y: Math.min(Math.max(EDGE_GAP, point.y), maxY)
    };
  }, []);

  useEffect(() => {
    let start = fallback();
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Point>;
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          start = { x: parsed.x, y: parsed.y };
        }
      }
    } catch { }
    setPos(clamp(start));
  }, []);

  useEffect(() => {
    const onResize = () => setPos((prev) => (prev ? clamp(prev) : prev));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      if (!pos) return;
      session.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: pos.x,
        originY: pos.y,
        moved: false
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [pos]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = session.current;
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      setDragging(true);
      setPos(clamp({ x: drag.originX + dx, y: drag.originY + dy }));
    },
    [clamp]
  );

  const endDrag = useCallback(
    (event: React.PointerEvent) => {
      const drag = session.current;
      session.current = null;
      setDragging(false);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {

      }
      if (drag?.moved) {
        setPos((prev) => {
          if (prev) {
            try {
              window.localStorage.setItem(storageKey, JSON.stringify(prev));
            } catch {

            }
          }
          return prev;
        });
      }
    },
    [storageKey]
  );

  return {
    ref,
    pos,
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag
    }
  };
}
