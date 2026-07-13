"""Pure geometry: turn a bag of positioned lines into ordered reading text.

Kept in the domain because it is engine-independent logic — the same rules
apply whether the boxes came from RapidOCR, EasyOCR, or a VLM. Groups lines
into rows by vertical overlap, orders rows top-to-bottom, and orders lines
within a row left-to-right (or right-to-left for RTL scripts like Arabic).
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
    ordered = sorted(lines, key=lambda l: l.box.y)

    rows: list[list[OcrLine]] = []
    for line in ordered:
        placed = False
        for row in rows:
            # Same row if vertical centres are within half a line height.
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
        out.append(" ".join(l.text for l in row).strip())
    return "\n".join(line for line in out if line)
