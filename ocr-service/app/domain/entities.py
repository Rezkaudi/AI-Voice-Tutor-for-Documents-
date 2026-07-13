"""Domain entities — plain data, no framework or engine dependencies.

These are the shapes every OCR engine must speak, regardless of the library
behind it (RapidOCR today, EasyOCR / a VLM sidecar tomorrow).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class BoundingBox:
    """Axis-aligned box derived from an engine's (possibly rotated) quad.

    Coordinates are in pixels of the source image. `x`/`y` is the top-left
    corner; `x2`/`y2` the bottom-right.
    """

    x: float
    y: float
    x2: float
    y2: float

    @property
    def width(self) -> float:
        return self.x2 - self.x

    @property
    def height(self) -> float:
        return self.y2 - self.y

    @property
    def cx(self) -> float:
        return (self.x + self.x2) / 2

    @property
    def cy(self) -> float:
        return (self.y + self.y2) / 2

    @classmethod
    def from_quad(cls, quad: list[list[float]]) -> "BoundingBox":
        """Build an axis-aligned box from a 4-point polygon [[x,y], ...]."""
        xs = [p[0] for p in quad]
        ys = [p[1] for p in quad]
        return cls(min(xs), min(ys), max(xs), max(ys))


@dataclass(frozen=True)
class OcrLine:
    """One recognized text line with its location and confidence."""

    text: str
    box: BoundingBox
    confidence: float


@dataclass
class OcrPage:
    """Result of running one image through one engine."""

    lines: list[OcrLine] = field(default_factory=list)
    text: str = ""
    engine: str = ""
    language: str | None = None
    elapsed_ms: float = 0.0
