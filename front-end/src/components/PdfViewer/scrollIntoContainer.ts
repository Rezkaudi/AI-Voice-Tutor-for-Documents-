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

export function scrollIntoContainerCenter(el: HTMLElement, smooth = true): void {
  const container = scrollableAncestor(el);
  if (!container) {
    el.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    return;
  }
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const delta =
    elRect.top - containerRect.top - (container.clientHeight - elRect.height) / 2;
  container.scrollTo({
    top: container.scrollTop + delta,
    behavior: smooth ? "smooth" : "auto"
  });
}
