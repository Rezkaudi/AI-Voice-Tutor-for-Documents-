"""The OCR port (interface).

Every concrete engine implements this. The rest of the app depends only on
this abstraction, never on a specific OCR library — that is what lets you add
or swap engines at any time without touching the API or the container wiring.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.entities import OcrPage


class OcrEngine(ABC):
    #: Stable identifier used to select this engine (e.g. "rapidocr").
    name: str

    @abstractmethod
    def supports(self, language: str | None) -> bool:
        """Whether this engine can handle the requested language code."""

    @abstractmethod
    def recognize(self, image: bytes, language: str | None = None) -> OcrPage:
        """Run OCR on a single image (PNG/JPEG bytes) and return a page."""
