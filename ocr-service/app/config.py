"""Configuration — the only place that knows which engines exist and how they
are tuned for throughput.

Add a new engine's models here (or via env vars) and register it in the
container; nothing else in the codebase changes.
"""

from __future__ import annotations

import os

from pydantic_settings import BaseSettings, SettingsConfigDict

_CORES = os.cpu_count() or 4


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="OCR_", env_file=".env", extra="ignore")

    # Engine selected when a request does not ask for a specific one.
    default_engine: str = "rapidocr"

    # Optional language-specific RapidOCR recognition models. Leave blank to
    # use RapidOCR's bundled multilingual (Chinese+English) model.
    rapidocr_japanese_rec_path: str = ""
    rapidocr_arabic_rec_path: str = ""

    # ─── Throughput tuning ───────────────────────────────────────────────────
    # Threads ONE page's inference may use. Keep this small so several pages can
    # run in parallel and fill all cores instead of one page hogging them all.
    intra_threads: int = 3
    # Max pages processed simultaneously. cores / intra_threads keeps the CPU
    # saturated without oversubscribing (e.g. 12 cores / 3 = 4 pages at once).
    max_concurrency: int = max(1, _CORES // 3)
    # Text crops batched per recognition inference. Higher = faster on dense
    # pages (lots of text lines), at some memory cost.
    rec_batch_num: int = 16
    # Detection input size cap (min side). Higher = small/faint text is detected
    # far more reliably (better completeness), at some detection-speed cost.
    # 736 is the model default; 960 recovers noticeably more text.
    det_limit_side_len: int = 960
    # ─── Detection recall (completeness) ─────────────────────────────────────
    # Min confidence for a detected text box to be kept. Lower = more boxes
    # (fewer missed words), at the risk of some noise. Model default 0.5.
    det_box_thresh: float = 0.4
    # How much each detected box is expanded before cropping. Higher = fewer
    # truncated words at line edges. Model default 1.6.
    det_unclip_ratio: float = 1.8
    # Min recognition score for text to be kept. Lower = keeps more low-contrast
    # text instead of discarding it. Model default 0.5.
    text_score: float = 0.3
    # Warm the models (run one dummy inference) at startup so the first real
    # request doesn't pay the ONNX Runtime cold-start cost.
    warmup: bool = True

    host: str = "0.0.0.0"
    port: int = 8000


settings = Settings()
