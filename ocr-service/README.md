# OCR (Python Cloud Run **function**) — official PaddleOCR

Pure-Python Cloud Run function that runs the **entire** OCR pipeline with the
**official `paddleocr` package** (same API as the *Document AI* course). The Node
backend contains no OCR code — it just calls this function over HTTP. **No Node,
no Dockerfile** — flat files + a single entry point (`ocr`).

## Pipeline (all in Python)

```
render (pypdfium2)                       PDF page → image
  → recognize (paddleocr: PaddleOCR)     detect + recognize text (+ boxes, scores)
  → layout (paddleocr: LayoutDetection)  regions (tables/figures/headers)
  → reading-order + RTL + normalize      ported from the backend TS
  → final page text
```

OCR/layout use the official package exactly like the course:

```python
from paddleocr import PaddleOCR, LayoutDetection
ocr = PaddleOCR(lang='en'); page = ocr.predict(img)[0]      # rec_texts / rec_scores / rec_polys
layout = LayoutDetection(); boxes = layout.predict(img)[0]['boxes']  # label / score / coordinate
```

## Files

```
main.py            entry point def ocr(request); model auto-select; returns text
render.py          pypdfium2 → 150dpi page images
ocr.py             official PaddleOCR (detect + recognize)
layout.py          official PaddleOCR LayoutDetection
reading_order.py   port of ReadingOrderBuilder (columns/tables/reading order)
text_assembly.py   toPageText + cleanOcrText (NFKC) → final text
script_direction.py / rtl.py / script_detector.py   RTL + model auto-detect
assembly.py        line grouping
config.py          langs + thresholds
```

## ⚠️ Two things to know (vs the old backend OCR)

1. **Different models.** This uses PaddleOCR's own models (PP-OCRv5 +
   LayoutDetection), **not** the old `ppu` ONNX weights → OCR output will
   **differ** from the previous backend. Re-check citations on real PDFs.
2. **Heavier.** `paddlepaddle` is a ~500 MB+ framework. Plan **4 GB RAM / 4 vCPU**
   on Cloud Run (not 2 GB). PaddleOCR 3.x has had CPU memory spikes on some
   languages — load-test your real docs.

## Run locally

```bash
cd ocr-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# first run downloads PaddleOCR models to ~/.paddlex
functions-framework --target ocr --port 8080
# smoke test lives in local/ (gitignored, not uploaded):
python local/smoke_test.py ../files-examples/some.pdf --pages 1,2
```

## Point the backend at it

The backend **requires** this function (no in-process OCR fallback). In `back-end/.env`:

```
OCR_SERVICE_URL=http://localhost:8080
# OCR_SERVICE_TIMEOUT_MS=120000   # optional
```

## Endpoints

| Method | Path             | Body                   | Returns                             |
| ------ | ---------------- | ---------------------- | ----------------------------------- |
| GET    | `/health`        | —                      | `{ ok: true }`                      |
| POST   | `/count-pages`   | `{ pdf }` (base64)     | `{ count }`                         |
| POST   | `/extract-pages` | `{ pdf, pages:[1,2] }` | `{ pages:[{ page_number, text }] }` |

Default-vs-Arabic model selection happens inside the function (probe + script
detector), cached per PDF.

## Configuration (env vars)

| Var                   | Default | Purpose                          |
| --------------------- | ------- | -------------------------------- |
| `OCR_DPI`             | `150`   | Render DPI.                      |
| `OCR_DEFAULT_LANG`    | `en`    | PaddleOCR lang for default text. |
| `OCR_ARABIC_LANG`     | `arabic`| PaddleOCR lang for Arabic pages. |
| `OCR_MIN_CONFIDENCE`  | `0.5`   | Recognition confidence floor.    |
| `OCR_LAYOUT_MIN_SCORE`| `0.5`   | Layout region score floor.       |
| `OCR_ENABLE_MKLDNN`   | `false` | Enable Paddle CPU MKLDNN/oneDNN. |
| `OCR_CPU_THREADS`     | `4`     | Paddle intra-op thread pool size — match to the Cloud Run vCPU limit, not left to Paddle's own default, or a saturated container just thrashes on context switches. |
| `OCR_DETECTION_MODEL` | `PP-OCRv5_mobile_det` | Text detection model. Unset default is the "_server" variant — accurate but far slower on CPU. |
| `OCR_RECOGNITION_MODEL` | `PP-OCRv5_mobile_rec` | Text recognition model (default engine only; the Arabic engine keeps its lang-selected rec model). |
| `OCR_LAYOUT_MODEL`    | `PP-DocLayout-S` | Layout model. Unset default is PP-DocLayout-L (~760ms/inference on CPU); -S is ~50x faster at lower classification mAP, acceptable since layout only feeds reading-order here. |

## Deploy as a Cloud Run function (you do this later — not automated here)

```bash
# use the same region as your backend Cloud Run service:
#   gcloud run services list --project ai-sensei-498811
gcloud run deploy ocr-service \
  --source . --function ocr \
  --project ai-sensei-498811 \
  --region <YOUR_REGION> \
  --memory 4Gi --cpu 4 --timeout 300 --min-instances 1 --allow-unauthenticated
```

`--function ocr` = source-based function (no Dockerfile) under the **Functions**
tab. `--min-instances 1` avoids re-downloading models on cold start. Then set
`OCR_SERVICE_URL` on the backend to the printed URL.

### Public service health checks

Use the canonical service URL printed by Cloud Run:

```bash
gcloud run services describe ocr-service \
  --project ai-sensei-498811 \
  --region europe-west1 \
  --format='value(status.url)'
```

Point the backend at that URL:

```bash
gcloud run services update ai-sensei-backend \
  --project ai-sensei-498811 \
  --region europe-west1 \
  --update-env-vars OCR_SERVICE_URL=https://ocr-service-6cbj5x2uba-ew.a.run.app,OCR_SERVICE_TIMEOUT_MS=300000
```

The backend calls this OCR service without a Google ID token. If the service was
previously deployed as private, allow unauthenticated access or the backend will
receive `403 Forbidden` from Cloud Run:

```bash
gcloud run services add-iam-policy-binding ocr-service \
  --project ai-sensei-498811 \
  --region europe-west1 \
  --member='allUsers' \
  --role='roles/run.invoker'
```

Public access exposes the expensive `/extract-pages` endpoint, so add an API
gateway, ingress restriction, or rate limiting if this service is reachable from
outside trusted infrastructure.
