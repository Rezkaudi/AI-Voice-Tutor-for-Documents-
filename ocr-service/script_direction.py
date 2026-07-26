"""Port of the backend ScriptDirection (domain/logic/pdf/script-direction.ts)."""

from __future__ import annotations

import re

# Strong RTL characters: Arabic and Hebrew, base and presentation blocks.
_RTL = re.compile(r"[֐-ۿݐ-ݿࢠ-ࣿיִ-﷿ﹰ-﻿]")
# Strong LTR letters: Latin, Greek, Cyrillic, and CJK.
_LTR = re.compile(r"[A-Za-zÀ-ɏͰ-ϿЀ-ӿ぀-ヿ㐀-鿿]")


def is_right_to_left(text: str) -> bool:
    return len(_RTL.findall(text)) > len(_LTR.findall(text))
