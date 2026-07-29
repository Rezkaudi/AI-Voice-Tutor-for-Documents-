"""OCR Cloud Run function (pure Python).

Full pipeline in Python — render → recognize (PP-OCRv6/PP-OCRv5 ONNX) → layout
(PP-DocLayoutV2 ONNX) → reading-order + RTL + normalize → **final page text**.
The Node backend keeps zero OCR code; it just calls these endpoints.

The Node backend sends the PDF as a presigned S3 URL (`{ "url": ... }`) and this
service streams the file straight from object storage — the bytes never travel
through the request body.

Entry point: `ocr` (functions-framework). Routes on request path:
  GET  /health         → liveness
  POST /count-pages    → { count }          · body: { url }
  POST /detect-model   → { model }          · body: { url }
  POST /extract-pages  → { pages:[...] }    · body: { url, pages, model? }

`model` on /extract-pages is the choice /detect-model already made for this
document. Passing it skips a two-page probe that every fresh instance would
otherwise repeat; the recognition itself is unchanged either way.

Local run:   functions-framework --target ocr --port 8080
Deploy:      gcloud run deploy ocr-service --source . --function ocr ...
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import threading
import time
import urllib.request
from urllib.parse import urlparse

import functions_framework
import numpy as np

from assembly import group_into_lines
from config import Settings
from layout import LayoutEngine
from ocr import OcrEngine
from render import PageRenderer
from script_detector import RecognitionSample, default_model_failed
from text_assembly import to_page_text

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    force=True,
)
log = logging.getLogger("ocr-fn")

_settings = Settings()
_renderer: PageRenderer | None = None
_ocr: OcrEngine | None = None
_layout: LayoutEngine | None = None
_model_cache: dict[str, str] = {}

_engine_lock = threading.Lock()

_PROBE_PAGE_COUNT = 2
_VALID_MODELS = {"default", "arabic"}

# Engines are built lazily on first use, which cost ~20s of *request* latency
# on every cold instance. Warming them on a background thread at import keeps
# the port open for health checks while the models load out of band.
_WARMUP_ENABLED = os.getenv("OCR_WARMUP", "true").lower() in {"1", "true", "yes", "on"}
# Accept comma, colon, semicolon or whitespace: `gcloud --set-env-vars` treats
# commas as its own separator, so a comma-delimited value cannot be passed
# without the alternate-delimiter syntax.
_WARMUP_MODELS = [
    model
    for model in re.split(r"[,:;\s]+", os.getenv("OCR_WARMUP_MODELS", "default,arabic"))
    if model in _VALID_MODELS
]
_warmup_started = False
_warmup_lock = threading.Lock()

_ALLOWED_SCHEMES = {"http", "https"}
_MAX_PDF_BYTES = int(os.getenv("OCR_MAX_PDF_BYTES", str(200 * 1024 * 1024)))
_DOWNLOAD_TIMEOUT_S = float(os.getenv("OCR_DOWNLOAD_TIMEOUT_S", "60"))

_PDF_CACHE_TTL_S = float(os.getenv("OCR_PDF_CACHE_TTL_S", "300"))
_PDF_CACHE_MAX = int(os.getenv("OCR_PDF_CACHE_MAX", "4"))
_pdf_cache: dict[str, tuple[float, bytes]] = {}
_pdf_cache_lock = threading.Lock()


def _get_renderer() -> PageRenderer:
    global _renderer
    if _renderer is None:
        with _engine_lock:
            if _renderer is None:
                _renderer = PageRenderer(_settings)
    return _renderer


def _get_ocr() -> OcrEngine:
    global _ocr
    if _ocr is None:
        with _engine_lock:
            if _ocr is None:
                _ocr = OcrEngine(_settings)
    return _ocr


def _get_layout() -> LayoutEngine:
    """PaddleOCR LayoutDetection — heavy; loaded only when a page is extracted."""
    global _layout
    if _layout is None:
        with _engine_lock:
            if _layout is None:
                started = time.time()
                _layout = LayoutEngine(_settings)
                log.info("layout engine ready in %.1fs", time.time() - started)
    return _layout


def _load_pdf(body: dict) -> bytes:
    """The PDF bytes, streamed from the presigned S3 URL in the request body."""
    url = body.get("url")
    if not url:
        raise ValueError("request must include a 'url'")
    return _download(url)


def _download(url: str) -> bytes:
    parsed = urlparse(url)
    if parsed.scheme not in _ALLOWED_SCHEMES:
        raise ValueError(f"unsupported url scheme: {parsed.scheme or '(none)'}")

    cache_key = f"{parsed.netloc}{parsed.path}"
    cached = _pdf_cache_get(cache_key)
    if cached is not None:
        return cached

    started = time.time()
    try:
        request = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(request, timeout=_DOWNLOAD_TIMEOUT_S) as response:
            declared = response.headers.get("Content-Length")
            if declared is not None and int(declared) > _MAX_PDF_BYTES:
                raise ValueError(f"pdf exceeds {_MAX_PDF_BYTES} byte limit")
            data = _read_capped(response, _MAX_PDF_BYTES)
    except (OSError, ValueError) as error:
        raise ValueError(f"failed to fetch pdf: {error}") from error

    log.info("downloaded pdf (%d bytes) in %dms", len(data), int((time.time() - started) * 1000))
    _pdf_cache_put(cache_key, data)
    return data


def _read_capped(response, limit: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = response.read(1 << 16)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise ValueError(f"pdf exceeds {limit} byte limit")
        chunks.append(chunk)
    return b"".join(chunks)


def _pdf_cache_get(key: str) -> bytes | None:
    now = time.time()
    with _pdf_cache_lock:
        entry = _pdf_cache.get(key)
        if entry is None:
            return None
        expires_at, data = entry
        if expires_at < now:
            _pdf_cache.pop(key, None)
            return None
        return data


def _pdf_cache_put(key: str, data: bytes) -> None:
    with _pdf_cache_lock:
        # Evict the soonest-to-expire entries once the cache is full.
        while len(_pdf_cache) >= _PDF_CACHE_MAX and key not in _pdf_cache:
            oldest = min(_pdf_cache, key=lambda k: _pdf_cache[k][0])
            _pdf_cache.pop(oldest, None)
        _pdf_cache[key] = (time.time() + _PDF_CACHE_TTL_S, data)


def _fingerprint(pdf_bytes: bytes) -> str:
    n = len(pdf_bytes)
    sample = min(4096, n)
    h = hashlib.sha1()
    h.update(str(n).encode())
    h.update(pdf_bytes[:sample])
    h.update(pdf_bytes[n - sample :])
    return h.hexdigest()


def _detect_model(pdf_bytes: bytes) -> str:
    """Port of PaddleOcrTextExtractor.detectModel: probe first pages with the
    default model, then let OcrScriptDetector decide default vs arabic."""
    renderer, ocr = _get_renderer(), _get_ocr()
    try:
        total = renderer.count(pdf_bytes)
        probe = list(range(1, min(_PROBE_PAGE_COUNT, total) + 1))
        rendered = renderer.render(pdf_bytes, probe)
        if not rendered:
            return "default"
        samples: list[RecognitionSample] = []
        for _, image in rendered:
            for item in ocr.recognize(image, "default"):
                samples.append(RecognitionSample(text=item.text, confidence=item.confidence))
        choice = "arabic" if default_model_failed(samples) else "default"
        log.info("auto-detected script → %s model (probed %d page(s))", choice, len(rendered))
        return choice
    except Exception as error:  # noqa: BLE001
        log.warning("script auto-detection failed, using default model: %s", error)
        return "default"


def _choose_model(pdf_bytes: bytes) -> str:
    key = _fingerprint(pdf_bytes)
    cached = _model_cache.get(key)
    if cached:
        return cached
    choice = _detect_model(pdf_bytes)
    _model_cache[key] = choice
    return choice


def _extract_pages(body: dict) -> dict:
    renderer, ocr, layout = _get_renderer(), _get_ocr(), _get_layout()
    pdf_bytes = _load_pdf(body)
    pages = body.get("pages") or []

    started = time.time()
    # The caller may pass the model it already resolved via /detect-model. The
    # probe is deterministic for a given PDF, so this is the same choice the
    # local detection would make — it just is not recomputed on every instance
    # that has not seen this document before.
    requested = body.get("model")
    model = requested if requested in _VALID_MODELS else _choose_model(pdf_bytes)
    rendered = renderer.render(pdf_bytes, pages)
    out_pages = []
    for page_number, image in rendered:
        items = ocr.recognize(image, model)
        regions = layout.detect(image)
        lines = group_into_lines(items)
        out_pages.append({"page_number": page_number, "text": to_page_text(lines, regions, model)})
    log.info(
        "extracted %d page(s) with %s model in %dms",
        len(out_pages),
        model,
        int((time.time() - started) * 1000),
    )
    return {"pages": out_pages}


def _count_pages(body: dict) -> dict:
    return {"count": _get_renderer().count(_load_pdf(body))}


def _detect_model_route(body: dict) -> dict:
    """Resolves the OCR model for a document once, so callers can pass it to
    every /extract-pages request instead of each instance re-probing."""
    return {"model": _choose_model(_load_pdf(body))}


def _warmup() -> None:
    """Builds the renderer, layout and recognition engines ahead of traffic."""
    started = time.time()
    try:
        _get_renderer()
        _get_layout()
        blank = np.zeros((320, 320, 3), dtype="uint8")
        for model in _WARMUP_MODELS:
            _get_ocr().recognize(blank, model)
        log.info(
            "warmup complete in %.1fs (models=%s)", time.time() - started, ",".join(_WARMUP_MODELS)
        )
    except Exception as error:  # noqa: BLE001
        # Warmup is an optimisation; a failure here must not stop the service
        # from starting, since the lazy path still works.
        log.warning("warmup failed (engines will load on first request): %s", error)


def _ensure_warmup() -> None:
    """Starts warmup once per process.

    Deploying with `--function` replaces the image's CMD with Google's own
    functions-framework launcher, which does not reliably run module-level
    side effects early enough to observe. Kicking warmup from the first
    request — including the startup probe's /health — makes it independent of
    how the process was launched. The thread is daemonised so it never holds
    up shutdown, and every engine getter is already lock-guarded, so a real
    request arriving mid-warmup simply waits on the same lock it would have
    taken anyway.
    """
    global _warmup_started
    if _warmup_started or not _WARMUP_ENABLED:
        return
    with _warmup_lock:
        if _warmup_started:
            return
        _warmup_started = True
        log.info("starting warmup (models=%s)", ",".join(_WARMUP_MODELS) or "none")
        threading.Thread(target=_warmup, name="ocr-warmup", daemon=True).start()


_ensure_warmup()


@functions_framework.http
def ocr(request):
    """HTTP entry point. Dispatches on path."""
    _ensure_warmup()
    path = (request.path or "/").rstrip("/") or "/"

    if path.endswith("/health") or path == "/":
        return {"ok": True}

    body = request.get_json(silent=True) or {}
    try:
        if path.endswith("/count-pages"):
            return _count_pages(body)
        if path.endswith("/extract-pages"):
            return _extract_pages(body)
        if path.endswith("/detect-model"):
            return _detect_model_route(body)
    except ValueError as error:
        return ({"error": str(error)}, 400)
    except KeyError as error:
        return ({"error": f"missing field: {error}"}, 400)

    return ({"error": f"unknown path: {path}"}, 404)
