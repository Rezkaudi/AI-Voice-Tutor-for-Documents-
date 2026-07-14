# OCR Service

A small, clean-architecture OCR sidecar. Swap or add OCR engines at any time
without touching the API — engines are wired in one place (`app/container.py`)
behind a single `OcrEngine` port. The default engine is **RapidOCR**
(PaddleOCR-quality models on ONNX Runtime: fast, low-memory, no PaddlePaddle).

## Layout (clean architecture)

```
app/
├── domain/                     # framework-free core
│   ├── entities.py             #   OcrPage / OcrLine / BoundingBox
│   ├── ocr_engine.py           #   OcrEngine  (the port every engine implements)
│   └── logic/reading_order.py  #   pure geometry: boxes -> reading-order text (RTL aware)
├── infrastructure/
│   └── engines/rapidocr_engine.py   # RapidOCR adapter (implements the port)
├── api/                        # HTTP delivery (FastAPI)
│   ├── routes.py               #   /ocr  /engines  /health
│   └── schemas.py              #   request/response DTOs
├── config.py                   # settings (env-driven)
├── container.py                # composition root / engine registry (DI)
└── main.py                     # entrypoint
```

The dependency rule points inward: `api` and `infrastructure` depend on
`domain`; `domain` depends on nothing.

## Run

```bash
cd ocr-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --port 8000
```

## Use

```bash
# List available engines
curl localhost:8000/engines

# OCR an image (engine auto-selected by language + RTL ordering hint)
curl -F file=@page.png -F language=ar localhost:8000/ocr
```

Response:

```json
{
  "engine": "rapidocr",
  "language": "ar",
  "elapsed_ms": 210.4,
  "text": "reconstructed reading-order text...",
  "lines": [{ "text": "...", "confidence": 0.98, "box": [x, y, x2, y2] }]
}
```

## Add another engine (the whole point)

1. Create `app/infrastructure/engines/<name>_engine.py` implementing `OcrEngine`
   (`name`, `supports()`, `recognize()`).
2. Register it in `app/container.py` → `build_registry()`.

That's it — language-based auto-selection picks it up via `supports()`.
No API or domain changes.

Examples you can drop in next: `EasyOcrEngine` (best Arabic accuracy), or a
`PaddleVlEngine` HTTP client that forwards to a GPU VLM sidecar.

## From the TS backend

Call it like the existing VL sidecar (`OCR_VL_SERVICE_URL` pattern): POST the
page image to `/ocr`, read `text` (already in reading order) and `lines`
(boxes + confidence) for your highlight/citation alignment.
```
