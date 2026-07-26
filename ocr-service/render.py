"""PDF page rendering via PyPDFium2 — the same PDFium engine the backend's
@hyzyla/pdfium binding wraps.

Mirrors PdfiumPageRenderer: renders at a fixed DPI in grayscale, then replicates
the gray channel across RGB (the backend encodes gray-as-RGB before OCR), so the
pixels handed to the OCR/layout models match what the Node pipeline produced.
"""

from __future__ import annotations

import numpy as np
import pypdfium2 as pdfium

from config import Settings


class PageRenderer:
    def __init__(self, settings: Settings) -> None:
        self._dpi = settings.dpi

    def count(self, pdf_bytes: bytes) -> int:
        pdf = pdfium.PdfDocument(pdf_bytes)
        try:
            return len(pdf)
        finally:
            pdf.close()

    def render(self, pdf_bytes: bytes, page_numbers: list[int]) -> list[tuple[int, np.ndarray]]:
        """Returns (page_number, HxWx3 uint8 gray-as-RGB) for each valid page,
        de-duplicated and in ascending page order (matches PdfiumPageRenderer)."""
        pdf = pdfium.PdfDocument(pdf_bytes)
        try:
            total = len(pdf)
            scale = self._dpi / 72.0
            wanted = sorted({p for p in page_numbers if 1 <= p <= total})
            out: list[tuple[int, np.ndarray]] = []
            for page_number in wanted:
                page = pdf[page_number - 1]
                bitmap = page.render(scale=scale, grayscale=True)
                arr = bitmap.to_numpy()
                gray = arr[..., 0] if arr.ndim == 3 else arr
                rgb = np.repeat(gray[:, :, np.newaxis], 3, axis=2).astype(np.uint8)
                out.append((page_number, rgb))
            return out
        finally:
            pdf.close()
