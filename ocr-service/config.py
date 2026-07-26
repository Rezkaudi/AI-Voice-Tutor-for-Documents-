"""Runtime configuration for the official PaddleOCR pipeline.

Uses the official `paddleocr` package (PaddleOCR + LayoutDetection), same as the
course. PaddleOCR downloads and caches its own models under ~/.paddlex on first
run — no manual model download here.
"""

from __future__ import annotations

import os


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value.lower() in {"1", "true", "yes", "on"}


class Settings:
    def __init__(self) -> None:
        self.dpi: int = int(os.getenv("OCR_DPI", "150"))

        self.default_lang: str = os.getenv("OCR_DEFAULT_LANG", "en")
        self.arabic_lang: str = os.getenv("OCR_ARABIC_LANG", "arabic")

        self.ocr_min_confidence: float = float(os.getenv("OCR_MIN_CONFIDENCE", "0.5"))
        self.layout_min_score: float = float(os.getenv("OCR_LAYOUT_MIN_SCORE", "0.5"))

        self.enable_mkldnn: bool = _bool_env("OCR_ENABLE_MKLDNN", False)

        self.cpu_threads: int = int(os.getenv("OCR_CPU_THREADS", "4"))

        self.detection_model_name: str = os.getenv("OCR_DETECTION_MODEL", "PP-OCRv5_mobile_det")
        self.recognition_model_name: str = os.getenv("OCR_RECOGNITION_MODEL", "PP-OCRv5_mobile_rec")
 
        self.arabic_recognition_model_name: str = os.getenv(
            "OCR_ARABIC_RECOGNITION_MODEL", "arabic_PP-OCRv5_mobile_rec"
        )

        self.layout_model_name: str = os.getenv("OCR_LAYOUT_MODEL", "PP-DocLayout-S")
