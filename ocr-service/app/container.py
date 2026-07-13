"""Composition root — the DI container / engine registry.

This mirrors the back-end's `container.ts`: one place that constructs concrete
implementations and wires them behind the `OcrEngine` port. To add an engine,
register it here — the API and domain never change.

Selecting an engine at request time:
  - explicit name  -> registry.get("easyocr")
  - by language    -> registry.for_language("ar")  (first that supports it)
  - otherwise      -> registry.default()
"""

from __future__ import annotations

from app.config import settings
from app.domain.ocr_engine import OcrEngine
from app.infrastructure.engines.rapidocr_engine import RapidOcrEngine


class OcrRegistry:
    def __init__(self, default_engine: str) -> None:
        self._engines: dict[str, OcrEngine] = {}
        self._default = default_engine

    def register(self, engine: OcrEngine) -> "OcrRegistry":
        self._engines[engine.name] = engine
        return self

    def names(self) -> list[str]:
        return list(self._engines)

    def get(self, name: str) -> OcrEngine:
        if name not in self._engines:
            raise KeyError(f"unknown OCR engine '{name}'. available: {self.names()}")
        return self._engines[name]

    def default(self) -> OcrEngine:
        return self.get(self._default)

    def for_language(self, language: str | None) -> OcrEngine:
        """Pick the default if it supports the language, else the first that does."""
        default = self.default()
        if default.supports(language):
            return default
        for engine in self._engines.values():
            if engine.supports(language):
                return engine
        return default

    def all(self) -> list[OcrEngine]:
        return list(self._engines.values())


def _rapidocr_options() -> dict[str, object]:
    """Throughput tuning applied to every RapidOCR instance. Threads are capped
    per page so `max_concurrency` pages can run in parallel and fill the CPU."""
    return {
        "det_intra_op_num_threads": settings.intra_threads,
        "cls_intra_op_num_threads": settings.intra_threads,
        "rec_intra_op_num_threads": settings.intra_threads,
        "rec_batch_num": settings.rec_batch_num,
        "det_limit_side_len": settings.det_limit_side_len,
    }


def build_registry() -> OcrRegistry:
    registry = OcrRegistry(default_engine=settings.default_engine)
    options = _rapidocr_options()

    # --- Default engine: RapidOCR (English + Japanese + Chinese) ---------
    registry.register(
        RapidOcrEngine(
            name="rapidocr",
            rec_model_path=settings.rapidocr_japanese_rec_path or None,
            options=options,
        )
    )

    # --- Optional: a dedicated Arabic RapidOCR, only if a model is set ---
    # Register more engines the same way (EasyOCR, a VLM HTTP client, ...).
    if settings.rapidocr_arabic_rec_path:
        registry.register(
            RapidOcrEngine(
                name="rapidocr-arabic",
                languages=["ar", "arabic"],
                rec_model_path=settings.rapidocr_arabic_rec_path,
                options=options,
            )
        )

    return registry


# Single shared instance, built once at import time.
registry = build_registry()
