"""API DTOs — the wire contract for the TS backend."""

from __future__ import annotations

from pydantic import BaseModel

from app.domain.entities import OcrPage


class LineDTO(BaseModel):
    text: str
    confidence: float
    box: list[float]  # [x, y, x2, y2]


class OcrResponse(BaseModel):
    engine: str
    language: str | None
    elapsed_ms: float
    text: str
    lines: list[LineDTO]

    @classmethod
    def from_page(cls, page: OcrPage) -> "OcrResponse":
        return cls(
            engine=page.engine,
            language=page.language,
            elapsed_ms=page.elapsed_ms,
            text=page.text,
            lines=[
                LineDTO(
                    text=l.text,
                    confidence=l.confidence,
                    box=[l.box.x, l.box.y, l.box.x2, l.box.y2],
                )
                for l in page.lines
            ],
        )
