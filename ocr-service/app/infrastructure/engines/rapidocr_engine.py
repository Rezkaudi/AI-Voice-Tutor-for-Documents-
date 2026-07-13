"""RapidOCR engine — PaddleOCR-quality models on ONNX Runtime.

Fast, low-memory, no PaddlePaddle dependency. This is the default engine.
Language-specific recognition models (Japanese, Arabic, ...) are plugged in
via `rec_model_path` so you can register several RapidOCR instances under
different names without changing any other code.

Throughput knobs (`options`) are passed straight through to RapidOCR as flat
kwargs — e.g. capping threads-per-page so several pages run in parallel.
"""

from __future__ import annotations

import io
import time

import numpy as np
from PIL import Image

from app.domain.entities import BoundingBox, OcrLine, OcrPage
from app.domain.logic.reading_order import assemble_text
from app.domain.ocr_engine import OcrEngine


class RapidOcrEngine(OcrEngine):
    def __init__(
        self,
        name: str = "rapidocr",
        languages: list[str] | None = None,
        rec_model_path: str | None = None,
        det_model_path: str | None = None,
        options: dict[str, object] | None = None,
    ) -> None:
        self.name = name
        # Empty list == "no restriction", accept any requested language.
        self._languages = {l.lower() for l in (languages or [])}
        self._rec_model_path = rec_model_path
        self._det_model_path = det_model_path
        self._options = options or {}
        self._ocr = None  # lazy: don't load models until first use

    def supports(self, language: str | None) -> bool:
        if not self._languages or not language:
            return True
        return language.strip().lower() in self._languages

    def _engine(self):
        if self._ocr is None:
            # Imported lazily so the process starts even if the heavy
            # dependency is missing until an engine is actually invoked.
            from rapidocr_onnxruntime import RapidOCR

            kwargs: dict[str, object] = dict(self._options)
            if self._rec_model_path:
                kwargs["rec_model_path"] = self._rec_model_path
            if self._det_model_path:
                kwargs["det_model_path"] = self._det_model_path
            self._ocr = RapidOCR(**kwargs)
        return self._ocr

    def warmup(self) -> None:
        """Run one tiny inference so ORT pays its cold-start cost now, not on
        the first real request."""
        blank = np.full((32, 320, 3), 255, dtype=np.uint8)
        self._engine()(blank)

    def recognize(self, image: bytes, language: str | None = None) -> OcrPage:
        started = time.perf_counter()
        img = np.asarray(Image.open(io.BytesIO(image)).convert("RGB"))

        result, _ = self._engine()(img)
        lines: list[OcrLine] = []
        for entry in result or []:
            quad, text, score = entry[0], entry[1], entry[2]
            lines.append(
                OcrLine(
                    text=text,
                    box=BoundingBox.from_quad(quad),
                    confidence=float(score),
                )
            )

        return OcrPage(
            lines=lines,
            text=assemble_text(lines, language),
            engine=self.name,
            language=language,
            elapsed_ms=round((time.perf_counter() - started) * 1000, 1),
        )
