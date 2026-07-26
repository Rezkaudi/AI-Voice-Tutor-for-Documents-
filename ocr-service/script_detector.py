"""Port of the backend OcrScriptDetector (domain/logic/pdf/ocr-script-detector.ts).

Decides whether the default model produced too few letters per box (a sign the
page is a script the default model can't read → switch to the Arabic model).
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass

_MIN_CONFIDENCE = 0.5
_MIN_CONFIDENT_BOXES = 8
_MAX_LETTERS_PER_BOX = 1.5
_MIN_MEAN_CONFIDENCE = 0.70
_CJK_GUARD_RATIO = 0.2


@dataclass
class RecognitionSample:
    text: str
    confidence: float


def _letter_count(text: str) -> int:
    return sum(1 for ch in text if unicodedata.category(ch).startswith("L"))


def _cjk_count(text: str) -> int:
    return sum(
        1
        for ch in text
        if 0x3040 <= ord(ch) <= 0x30FF  # Hiragana + Katakana
        or 0x3400 <= ord(ch) <= 0x9FFF  # CJK Unified (+ Ext A)
        or 0xAC00 <= ord(ch) <= 0xD7AF  # Hangul
    )


def default_model_failed(samples: list[RecognitionSample]) -> bool:
    confident = [s for s in samples if s.confidence >= _MIN_CONFIDENCE]
    if len(confident) < _MIN_CONFIDENT_BOXES:
        return False

    letters = sum(_letter_count(s.text) for s in confident)
    if letters == 0:
        return False

    if _cjk_count("".join(s.text for s in confident)) / letters >= _CJK_GUARD_RATIO:
        return False

    if letters / len(confident) < _MAX_LETTERS_PER_BOX:
        return True


    mean_confidence = sum(s.confidence for s in confident) / len(confident)
    return mean_confidence < _MIN_MEAN_CONFIDENCE
