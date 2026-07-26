"""Port of the backend RtlVisualOrderConverter (rtl-visual-order-converter.ts).

Converts a visually-ordered RTL string to logical order: mirror brackets,
reverse the whole string, then un-reverse embedded LTR runs (numbers/Latin).
"""

from __future__ import annotations

import re

_LTR_RUN = re.compile(r"[0-9A-Za-z٠-٩۰-۹]+")
_MIRROR = {
    "(": ")", ")": "(",
    "[": "]", "]": "[",
    "{": "}", "}": "{",
    "<": ">", ">": "<",
    "«": "»", "»": "«",
}


def to_logical(visual: str) -> str:
    mirrored = "".join(_MIRROR.get(ch, ch) for ch in visual)
    reversed_str = mirrored[::-1]
    return _LTR_RUN.sub(lambda m: m.group(0)[::-1], reversed_str)
