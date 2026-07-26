"""Final page-text assembly — ports PaddleOcrTextExtractor.toPageText / cleanOcrText
and TextNormalizer.canonicalize (the NFKC part used by OCR).

This is what makes the sidecar return the SAME final text the Node backend built,
so the front-end buildTextMap keeps working unchanged.
"""

from __future__ import annotations

import re
import unicodedata

import rtl
import script_direction
from layout import Region
from ocr import OcrItem
from reading_order import ReadingOrderBuilder

_MIN_CONFIDENCE = 0.5
_builder = ReadingOrderBuilder()

# cleanOcrText regexes (ported verbatim; \p{Lu} approximated by [A-Z] for the
# English "PAIR/GROUP WORK" case, which is the only place it applies).
_PAIR_GROUP = re.compile(r"\b((?:PAIR|GROUP) WORK)(?=[A-Z])")
_TRIPLE_DOTS = re.compile(r"\s*(?:\.\s*){3}")
_TRAILING_DOT_LETTER = re.compile(r"((?:\. ?){2,})[I|l]$")


def _clean_ocr_text(value: str) -> str:
    canon = unicodedata.normalize("NFKC", value)
    canon = _PAIR_GROUP.sub(r"\1 ", canon)
    canon = _TRIPLE_DOTS.sub(" . . .", canon)
    canon = _TRAILING_DOT_LETTER.sub(r"\1", canon)
    return canon.strip()


def _order_lines(lines: list[list[OcrItem]], regions: list[Region]) -> list[list[OcrItem]]:
    def project(items: list[OcrItem]) -> list[OcrItem]:
        return [it for it in items if it.confidence >= _MIN_CONFIDENCE]

    kept = project([it for line in lines for it in line])
    ordered = _builder.order(kept, regions)
    if ordered is not None:
        return ordered
    result: list[list[OcrItem]] = []
    for line in lines:
        projected = project(line)
        if projected:
            result.append(projected)
    return result


def to_page_text(lines: list[list[OcrItem]], regions: list[Region], model: str = "default") -> str:

    already_logical = model == "arabic"
    out: list[str] = []
    for line in _order_lines(lines, regions):
        raw = [item.text for item in line]
        if script_direction.is_right_to_left(" ".join(raw)):
            oriented = raw[::-1] if already_logical else [rtl.to_logical(text) for text in raw][::-1]
        else:
            oriented = raw
        texts = [t for t in (_clean_ocr_text(text) for text in oriented) if t]
        if texts:
            out.append(" ".join(texts))
    return "\n".join(out)
