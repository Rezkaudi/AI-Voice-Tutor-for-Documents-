function scrollableAncestor(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function tweenScrollTop(container: HTMLElement, to: number, duration: number): void {
  const max = container.scrollHeight - container.clientHeight;
  const target = Math.max(0, Math.min(to, max));
  const from = container.scrollTop;
  const delta = target - from;

  if (duration <= 0 || prefersReducedMotion() || Math.abs(delta) < 1) {
    container.scrollTop = target;
    return;
  }

  const start = performance.now();
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    container.scrollTop = from + delta * easeOutCubic(t);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function scrollIntoContainerCenter(el: HTMLElement, smooth = true): void {
  const container = scrollableAncestor(el);

  if (!container) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => el.scrollIntoView({ block: "center" }))
    );
    return;
  }

  const centre = (duration: number) => {
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const delta =
      elRect.top - containerRect.top - (container.clientHeight - elRect.height) / 2;
    tweenScrollTop(container, container.scrollTop + delta, duration);
  };

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      centre(smooth ? 340 : 0);
      setTimeout(() => centre(0), 380);
    })
  );
}
