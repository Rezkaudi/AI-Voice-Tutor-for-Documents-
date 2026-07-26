"""Text detection + recognition via the official PaddleOCR package.

Same API the course uses:
    from paddleocr import PaddleOCR
    ocr = PaddleOCR(lang='en')
    page = ocr.predict(image)[0]
    page['rec_texts'], page['rec_scores'], page['rec_polys']

Two engines are held: default (Latin/CJK) and arabic. The pipeline decides
which via script detection and passes `model`.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass

import numpy as np

from config import Settings

log = logging.getLogger("ocr")


@dataclass
class OcrItem:
    text: str
    confidence: float
    x: float
    y: float
    width: float
    height: float


class OcrEngine:
    def __init__(self, settings: Settings) -> None:
        self._s = settings
        self._engines: dict[str, object] = {}
        self._lock = threading.Lock()

    def _engine(self, model: str):
        cached = self._engines.get(model)
        if cached is not None:
            return cached

        with self._lock:
            cached = self._engines.get(model)
            if cached is not None:
                return cached

            from paddleocr import PaddleOCR

            lang = self._s.arabic_lang if model == "arabic" else self._s.default_lang
            log.info("loading PaddleOCR (lang=%s) — models download/cache on first run", lang)
          
            kwargs = dict(
                lang=lang,
                enable_mkldnn=self._s.enable_mkldnn,
                cpu_threads=self._s.cpu_threads,
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
                text_detection_model_name=self._s.detection_model_name,
            )
            kwargs["text_recognition_model_name"] = (
                self._s.arabic_recognition_model_name
                if model == "arabic"
                else self._s.recognition_model_name
            )
            engine = PaddleOCR(**kwargs)
            self._engines[model] = engine
            return engine

    def recognize(self, image: np.ndarray, model: str) -> list[OcrItem]:
        engine = self._engine(model)
        result = engine.predict(image)
        if not result:
            return []

        page = result[0]
        texts = page.get("rec_texts") or []
        scores = page.get("rec_scores")
        if scores is None:
            scores = [None] * len(texts)
        # rec_polys align with rec_texts; fall back to detection polys.
        polys = page.get("rec_polys")
        if polys is None:
            polys = page.get("dt_polys") or []

        items: list[OcrItem] = []
        for text, score, poly in zip(texts, scores, polys):
            confidence = float(score) if score is not None else 1.0
            if confidence < self._s.ocr_min_confidence:
                continue
            xs = [float(p[0]) for p in poly]
            ys = [float(p[1]) for p in poly]
            x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
            items.append(
                OcrItem(
                    text=str(text),
                    confidence=confidence,
                    x=x0,
                    y=y0,
                    width=x1 - x0,
                    height=y1 - y0,
                )
            )
        return items
