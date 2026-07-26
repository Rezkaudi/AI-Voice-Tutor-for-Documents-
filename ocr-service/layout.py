"""Layout / reading-order regions via the official PaddleOCR LayoutDetection.

Same API the course uses:
    from paddleocr import LayoutDetection
    layout_engine = LayoutDetection()
    for box in layout_engine.predict(image)[0]['boxes']:
        box['label'], box['score'], box['coordinate']  # [x1, y1, x2, y2]

Returns Region objects consumed by reading_order.py / text_assembly.py. On any
failure returns [] so the pipeline falls back to OCR line order.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

from config import Settings

log = logging.getLogger("layout")


@dataclass
class Region:
    label: str
    score: float
    x1: float
    y1: float
    x2: float
    y2: float


class LayoutEngine:
    def __init__(self, settings: Settings) -> None:
        self._s = settings
        from paddleocr import LayoutDetection

        log.info(
            "loading PaddleOCR LayoutDetection (model=%s) — models download/cache on first run",
            self._s.layout_model_name,
        )

        self._engine = LayoutDetection(
            model_name=self._s.layout_model_name,
            enable_mkldnn=self._s.enable_mkldnn,
            cpu_threads=self._s.cpu_threads,
        )

    def detect(self, image: np.ndarray) -> list[Region]:
        try:
            result = self._engine.predict(image)
            if not result:
                return []
            regions: list[Region] = []
            for box in result[0].get("boxes", []):
                score = float(box["score"])
                if score < self._s.layout_min_score:
                    continue
                x1, y1, x2, y2 = (float(c) for c in box["coordinate"])
                regions.append(Region(label=str(box["label"]), score=score, x1=x1, y1=y1, x2=x2, y2=y2))
            return regions
        except Exception as error:  
            log.error("layout analysis failed: %s", error)
            return []
