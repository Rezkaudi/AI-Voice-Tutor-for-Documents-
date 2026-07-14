"""HTTP delivery layer — thin. Parses the request, selects an engine from
the registry by language, runs it, maps to a DTO. No OCR logic lives here.

Recognition is CPU-bound and blocking, so it runs in a worker thread (ONNX
Runtime releases the GIL during inference) and is gated by a semaphore sized
to `max_concurrency` — enough pages to keep every core busy, no more.

Every request is logged to the console with its timing; the very first
request after boot is called out specially.
"""

from __future__ import annotations

import time

import anyio
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.api.schemas import OcrResponse
from app.config import settings
from app.container import registry
from app.logging_config import get_logger

router = APIRouter()
log = get_logger("api")

_semaphore = anyio.Semaphore(settings.max_concurrency)

# Request counter / first-request tracking (module-level state).
_request_count = 0
_boot_time = time.perf_counter()


@router.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "engines": registry.names(), "requests_served": _request_count}


@router.get("/engines")
def engines() -> dict[str, list[str]]:
    return {"engines": registry.names()}


@router.post("/ocr", response_model=OcrResponse)
async def ocr(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
) -> OcrResponse:
    """Run OCR on one image.

    - `language` : hint used for RTL ordering and engine auto-selection.
    """
    global _request_count
    _request_count += 1
    req_id = _request_count
    received = time.perf_counter()

    if req_id == 1:
        log.info(
            "🚀 FIRST request received %.1fs after startup (file=%s, lang=%s)",
            received - _boot_time,
            file.filename,
            language or "-",
        )

    image = await file.read()
    if not image:
        log.warning("#%d rejected — empty file", req_id)
        raise HTTPException(status_code=400, detail="empty file")

    selected = registry.for_language(language)
    log.info(
        "#%d ▶ start · %s · engine=%s · lang=%s · %d KB",
        req_id,
        file.filename,
        selected.name,
        language or "-",
        len(image) // 1024,
    )

    queued = time.perf_counter()
    async with _semaphore:
        wait_ms = (time.perf_counter() - queued) * 1000
        page = await anyio.to_thread.run_sync(selected.recognize, image, language)

    total_ms = (time.perf_counter() - received) * 1000
    log.info(
        "#%d ✔ done  · %s · %d line(s) · ocr=%.0fms · queue=%.0fms · total=%.0fms",
        req_id,
        file.filename,
        len(page.lines),
        page.elapsed_ms,
        wait_ms,
        total_ms,
    )
    return OcrResponse.from_page(page)
