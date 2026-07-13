"""Pure geometry: turn a bag of positioned lines into ordered reading text.

Kept in the domain because it is engine-independent logic — the same rules
apply whether the boxes came from RapidOCR, EasyOCR, or a VLM.

Ordering uses a recursive **XY-cut**: repeatedly split the page at the widest
column gutter (vertical whitespace) or block gap (horizontal whitespace),
recursing into each part. Vertical cuts are tried first so genuine columns are
read top-to-bottom within a column before moving right — the key fix for
multi-column / callout-heavy pages, where a naive row grouping reads straight
across the gutter and scrambles the text. A full-width header has no vertical
gutter, so it is isolated by a horizontal cut first, then the body below it
splits into columns. When no meaningful gap remains, the leaf block is grouped
into rows (top-to-bottom, left-to-right, or right-to-left for RTL scripts).
"""

from __future__ import annotations

from app.domain.entities import OcrLine

# Languages whose primary script reads right-to-left.
_RTL_LANGUAGES = {"ar", "arabic", "he", "hebrew", "fa", "persian", "ur", "urdu"}


def is_rtl(language: str | None) -> bool:
    return bool(language) and language.strip().lower() in _RTL_LANGUAGES


def assemble_text(lines: list[OcrLine], language: str | None = None) -> str:
    """Reconstruct reading-order text from positioned lines."""
    if not lines:
        return ""

    rtl = is_rtl(language)
    heights = sorted(line.box.height for line in lines if line.box.height > 0)
    unit = heights[len(heights) // 2] if heights else 1.0  # median line height
    rows = _order(list(lines), rtl, unit)
    return "\n".join(row for row in rows if row)


def _largest_gap(
    intervals: list[tuple[float, float]], min_gap: float
) -> float | None:
    """Midpoint of the widest gap between merged 1-D intervals, or None if no
    gap is at least `min_gap` wide."""
    merged: list[list[float]] = []
    for lo, hi in sorted(intervals):
        if merged and lo <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], hi)
        else:
            merged.append([lo, hi])

    best_width = min_gap
    cut: float | None = None
    for left, right in zip(merged, merged[1:]):
        gap = right[0] - left[1]
        if gap >= best_width:
            best_width = gap
            cut = (left[1] + right[0]) / 2
    return cut


def _order(lines: list[OcrLine], rtl: bool, unit: float) -> list[str]:
    """Recursive XY-cut → ordered list of text rows."""
    if len(lines) <= 1:
        return [lines[0].text.strip()] if lines else []

    # A column gutter is at least ~one line-height of empty vertical space; a
    # block gap the same. Floors guard against tiny median heights.
    min_v = max(unit * 0.8, 12.0)
    min_h = max(unit * 0.8, 10.0)

    # 1) Vertical cut first: split into columns and read each fully before the
    #    next. This is what keeps two-column text from interleaving.
    x_cut = _largest_gap([(l.box.x, l.box.x2) for l in lines], min_v)
    if x_cut is not None:
        left = [l for l in lines if l.box.cx < x_cut]
        right = [l for l in lines if l.box.cx >= x_cut]
        if left and right:
            first, second = (right, left) if rtl else (left, right)
            return _order(first, rtl, unit) + _order(second, rtl, unit)

    # 2) Horizontal cut: isolate a full-width header / block from what follows.
    y_cut = _largest_gap([(l.box.y, l.box.y2) for l in lines], min_h)
    if y_cut is not None:
        top = [l for l in lines if l.box.cy < y_cut]
        bottom = [l for l in lines if l.box.cy >= y_cut]
        if top and bottom:
            return _order(top, rtl, unit) + _order(bottom, rtl, unit)

    # 3) Leaf: a single block with no clean gutter — group into rows.
    return _rows(lines, rtl)


def _rows(lines: list[OcrLine], rtl: bool) -> list[str]:
    """Group nearby lines into rows (top-to-bottom), ordering within a row
    left-to-right (or right-to-left for RTL)."""
    ordered = sorted(lines, key=lambda l: l.box.y)
    rows: list[list[OcrLine]] = []
    for line in ordered:
        placed = False
        for row in rows:
            ref = row[0].box
            if abs(line.box.cy - ref.cy) <= max(ref.height, line.box.height) * 0.5:
                row.append(line)
                placed = True
                break
        if not placed:
            rows.append([line])

    out: list[str] = []
    for row in rows:
        row.sort(key=lambda l: l.box.x, reverse=rtl)
        text = " ".join(l.text for l in row).strip()
        if text:
            out.append(text)
    return out
