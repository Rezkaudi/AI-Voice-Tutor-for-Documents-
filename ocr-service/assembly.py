"""Line grouping — a faithful port of ReadingOrderBuilder.groupIntoLines.

The backend re-groups items via layout regions on the primary path, so this
grouping only shapes the fallback ordering (when layout is unusable). Porting it
exactly keeps that fallback behavior identical to today.
"""

from __future__ import annotations

from ocr import OcrItem


def group_into_lines(items: list[OcrItem]) -> list[list[OcrItem]]:
    if not items:
        return []

    by_top = sorted(items, key=lambda it: it.y + it.height / 2)
    lines: list[list[OcrItem]] = []
    center_sum = 0.0
    height_sum = 0.0
    for item in by_top:
        center_y = item.y + item.height / 2
        if lines:
            current = lines[-1]
            line_center = center_sum / len(current)
            tolerance = max(2.0, (height_sum / len(current)) * 0.5)
            if abs(center_y - line_center) <= tolerance:
                current.append(item)
                center_sum += center_y
                height_sum += item.height
                continue
        lines.append([item])
        center_sum = center_y
        height_sum = item.height

    for line in lines:
        line.sort(key=lambda it: it.x)
    return lines
