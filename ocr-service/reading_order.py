"""Port of the backend ReadingOrderBuilder (domain/logic/pdf/reading-order-builder.ts).

Reorders OCR items using layout regions so side-by-side columns are read
column-by-column instead of interleaved row-major. Ported method-for-method to
keep the final text identical to the Node pipeline.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, replace
from statistics import median

from layout import Region
from ocr import OcrItem

_TRAILING_LABELS = {"footer", "number", "footnote"}
_ROW_BOUND_LABELS = {"table", "chart", "figure", "image"}
_MIN_OVERLAP_RATIO = 0.3
_MAX_ORPHAN_RATIO = 0.5
_COLUMN_TOLERANCE = 24
_SPAN_TOLERANCE = 48
_MIN_COLUMN_LINES = 3
_MAX_IMAGE_NOISE_CONFIDENCE = 0.75
_MIN_COLUMN_TEXT_RATIO = 4

_END_DOTS = re.compile(r"(?:\. ?){2,}$|…$")


@dataclass
class _OrderedLine:
    items: list[OcrItem]
    splittable: bool


class ReadingOrderBuilder:
    def order(self, items: list[OcrItem], regions: list[Region]) -> list[list[OcrItem]] | None:
        if not items or not regions:
            return None

        buckets: list[list[OcrItem]] = [[] for _ in regions]
        orphans: list[OcrItem] = []
        for item in items:
            index = self._assign(item, regions)
            if index is None:
                orphans.append(item)
            elif not self._is_ignorable_image_noise(item, regions[index]):
                buckets[index].append(item)
        if len(orphans) / len(items) > _MAX_ORPHAN_RATIO:
            return None

        content: list[_OrderedLine] = []
        trailing: list[_OrderedLine] = []
        for index, region in enumerate(regions):
            splittable = self._is_splittable_region(region, regions)
            lines = [_OrderedLine(items=line, splittable=splittable) for line in self._group_into_lines(buckets[index])]
            if region.label in _TRAILING_LABELS:
                trailing.extend(lines)
            else:
                content.extend(lines)
        orphan_lines = [_OrderedLine(items=line, splittable=True) for line in self._group_into_lines(orphans)]

        ordered = self._read_columnwise(content + orphan_lines) + trailing
        return [line.items for line in ordered]

    def _is_splittable_region(self, region: Region, regions: list[Region]) -> bool:
        if region.label not in _ROW_BOUND_LABELS:
            return True
        return self._is_text_column_container(region, regions)

    def _is_text_column_container(self, region: Region, regions: list[Region]) -> bool:
        if region.label != "table":
            return False
        child_starts = sorted(
            other.x1
            for other in regions
            if other is not region
            and other.label not in _ROW_BOUND_LABELS
            and other.label not in _TRAILING_LABELS
            and self._is_inside(other, region)
        )
        clusters = 0
        last_start: float | None = None
        for start in child_starts:
            if last_start is None or start - last_start > _COLUMN_TOLERANCE:
                clusters += 1
                last_start = start
        return clusters >= 2

    def _is_inside(self, inner: Region, outer: Region) -> bool:
        t = _COLUMN_TOLERANCE
        return (
            inner.x1 >= outer.x1 - t
            and inner.y1 >= outer.y1 - t
            and inner.x2 <= outer.x2 + t
            and inner.y2 <= outer.y2 + t
        )

    def _is_ignorable_image_noise(self, item: OcrItem, region: Region) -> bool:
        return (
            region.label == "image"
            and item.confidence <= _MAX_IMAGE_NOISE_CONFIDENCE
            and len(item.text.strip()) <= 1
        )

    def _assign(self, item: OcrItem, regions: list[Region]) -> int | None:
        cx = item.x + item.width / 2
        cy = item.y + item.height / 2

        containing: int | None = None
        containing_area = math.inf
        for index, region in enumerate(regions):
            if cx < region.x1 or cx > region.x2 or cy < region.y1 or cy > region.y2:
                continue
            area = (region.x2 - region.x1) * (region.y2 - region.y1)
            if area < containing_area:
                containing = index
                containing_area = area
        if containing is not None:
            return containing

        item_area = max(1.0, item.width * item.height)
        best: int | None = None
        best_overlap = 0.0
        for index, region in enumerate(regions):
            width = min(item.x + item.width, region.x2) - max(item.x, region.x1)
            height = min(item.y + item.height, region.y2) - max(item.y, region.y1)
            overlap = max(0.0, width) * max(0.0, height)
            if overlap > best_overlap:
                best = index
                best_overlap = overlap
        if best is not None and best_overlap / item_area >= _MIN_OVERLAP_RATIO:
            return best
        return None

    def _group_into_lines(self, items: list[OcrItem]) -> list[list[OcrItem]]:
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

    def _read_columnwise(self, lines: list[_OrderedLine]) -> list[_OrderedLine]:
        seams = self._detect_column_seams(lines)
        if not seams:
            return lines

        fragments: list[_OrderedLine] = []
        for line in lines:
            if line.splittable:
                fragments.extend(self._split_at_seams(line, seams))
            else:
                fragments.append(line)

        result: list[_OrderedLine] = []
        run: list[tuple[_OrderedLine, int]] = []

        def flush() -> None:
            nonlocal run
            if run and any(entry[1] != run[0][1] for entry in run):
                run.sort(key=lambda e: (e[1], self._line_top(e[0])))
            result.extend(entry[0] for entry in run)
            run = []

        for line in fragments:
            column = self._column_of(line.items, seams)
            if column is None:
                flush()
                result.append(line)
            else:
                run.append((line, column))
        flush()
        return result

    def _line_top(self, line: _OrderedLine) -> float:
        return min(item.y for item in line.items)

    def _detect_column_seams(self, lines: list[_OrderedLine]) -> list[float]:
        candidates: list[dict] = []
        for line in lines:
            if not line.splittable:
                continue
            for i in range(1, len(line.items)):
                previous = line.items[i - 1]
                item = line.items[i]
                candidates.append(
                    {
                        "x": item.x,
                        "gap": item.x - (previous.x + previous.width),
                        "height": item.height,
                        "previousWidth": previous.width,
                        "previousHeight": previous.height,
                    }
                )
        seams: list[float] = []
        seams.extend(self._detect_region_column_seams(lines))
        if len(candidates) < _MIN_COLUMN_LINES:
            return self._unique_seams(seams)

        candidates.sort(key=lambda c: c["x"])
        cluster: list[dict] = []

        def close_cluster() -> None:
            nonlocal cluster
            if len(cluster) < _MIN_COLUMN_LINES:
                cluster = []
                return
            median_gap = median([c["gap"] for c in cluster])
            median_height = median([c["height"] for c in cluster])
            median_prev_width = median([c["previousWidth"] for c in cluster])
            median_prev_height = median([c["previousHeight"] for c in cluster])
            wide_enough = median_prev_width >= median_prev_height * _MIN_COLUMN_TEXT_RATIO
            if median_gap >= median_height * 0.5 and wide_enough:
                seams.append(median([c["x"] for c in cluster]))
            cluster = []

        for candidate in candidates:
            last = cluster[-1] if cluster else None
            if last and candidate["x"] - last["x"] > _COLUMN_TOLERANCE:
                close_cluster()
            cluster.append(candidate)
        close_cluster()
        return self._unique_seams(seams)

    def _detect_region_column_seams(self, lines: list[_OrderedLine]) -> list[float]:
        starts = sorted(
            (
                {
                    "x": min(it.x for it in line.items),
                    "width": max(it.x + it.width for it in line.items) - min(it.x for it in line.items),
                    "y": self._line_top(line),
                    "height": max(it.height for it in line.items),
                }
                for line in lines
                if line.splittable
            ),
            key=lambda s: s["x"],
        )
        if len(starts) < _MIN_COLUMN_LINES * 2:
            return []

        clusters: list[list[dict]] = []
        for start in starts:
            cluster = clusters[-1] if clusters else None
            last = cluster[-1] if cluster else None
            if not cluster or not last or start["x"] - last["x"] > _COLUMN_TOLERANCE:
                clusters.append([start])
            else:
                cluster.append(start)
        if len(clusters) < 2:
            return []

        seams: list[float] = []
        left_lines: list[dict] = []
        for cluster in clusters:
            if left_lines and self._has_aligned_left_rows(cluster, left_lines):
                seams.append(median([entry["x"] for entry in cluster]))
            left_lines.extend(cluster)
        return seams

    def _has_aligned_left_rows(self, right_cluster: list[dict], left_lines: list[dict]) -> bool:
        aligned = 0
        for right in right_cluster:
            for left in left_lines:
                same_row = abs(
                    left["y"] + left["height"] / 2 - (right["y"] + right["height"] / 2)
                ) <= max(left["height"], right["height"]) * 0.75
                wide_enough = left["width"] >= left["height"] * _MIN_COLUMN_TEXT_RATIO
                if same_row and wide_enough and left["x"] < right["x"] - _COLUMN_TOLERANCE:
                    aligned += 1
                    break
        return aligned >= _MIN_COLUMN_LINES

    def _unique_seams(self, seams: list[float]) -> list[float]:
        unique: list[float] = []
        for seam in sorted(seams):
            previous = unique[-1] if unique else None
            if previous is None or seam - previous > _COLUMN_TOLERANCE:
                unique.append(seam)
        return unique

    def _split_at_seams(self, line: _OrderedLine, seams: list[float]) -> list[_OrderedLine]:
        fragments: list[_OrderedLine] = []
        current: list[OcrItem] = []
        for item in line.items:
            for piece in self._split_spanning_item(item, seams):
                on_seam = any(abs(piece.x - seam) <= _COLUMN_TOLERANCE for seam in seams)
                if on_seam and current:
                    fragments.append(_OrderedLine(items=current, splittable=line.splittable))
                    current = []
                current.append(piece)
        if current:
            fragments.append(_OrderedLine(items=current, splittable=line.splittable))
        return fragments

    def _split_spanning_item(self, item: OcrItem, seams: list[float]) -> list[OcrItem]:
        pieces = [item]
        for seam in seams:
            next_pieces: list[OcrItem] = []
            for piece in pieces:
                next_pieces.extend(self._split_item_at_seam(piece, seam))
            pieces = next_pieces
        return pieces

    def _split_item_at_seam(self, item: OcrItem, seam: float) -> list[OcrItem]:
        right = item.x + item.width
        if seam <= item.x + _COLUMN_TOLERANCE or seam >= right - _COLUMN_TOLERANCE:
            return [item]

        split_index = self._find_column_text_split(item.text, (seam - item.x) / item.width)
        if split_index is None:
            return [item]

        left_text = item.text[:split_index].strip()
        right_text = item.text[split_index:].strip()
        if not left_text or not right_text:
            return [item]

        return [
            replace(item, text=left_text, width=seam - item.x),
            replace(item, text=right_text, x=seam, width=right - seam),
        ]

    def _find_column_text_split(self, text: str, ratio: float) -> int | None:
        target = math.floor(len(text) * ratio + 0.5)  # match JS Math.round
        spaces = [
            m.start()
            for m in re.finditer(r"\s+", text)
            if len(text) * 0.2 < m.start() < len(text) * 0.85
        ]
        if not spaces:
            return None

        candidates = [
            index
            for index in spaces
            if _END_DOTS.search(text[:index].strip()) and self._starts_with_word(text[index:].strip())
        ]
        if not candidates:
            return None

        split = min(candidates, key=lambda index: abs(index - target))
        if abs(split - target) > len(text) * 0.15:
            return None
        return split

    @staticmethod
    def _starts_with_word(text: str) -> bool:
        # TS: /^[\p{L}\p{N}"']+/u — first char is a letter, number, quote, or apostrophe.
        if not text:
            return False
        c = text[0]
        return c.isalnum() or c in "\"'"

    def _column_of(self, items: list[OcrItem], seams: list[float]) -> int | None:
        min_x = min(item.x for item in items)
        max_x = max(item.x + item.width for item in items)
        column = 0
        for seam in seams:
            if min_x >= seam - _COLUMN_TOLERANCE:
                column += 1
                continue
            if max_x > seam + _SPAN_TOLERANCE:
                return None
        return column
