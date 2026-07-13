# OCR Service — RapidOCR (ONNX) FastAPI sidecar.
# Built by Google Cloud Build, runs on Cloud Run.
FROM python:3.11-slim

# OpenCV (pulled in by rapidocr-onnxruntime) needs these shared libs at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    # Cloud Run sends traffic to $PORT (defaults to 8080).
    PORT=8080

WORKDIR /app

# Install deps first so this layer caches across code changes.
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Pre-download the RapidOCR models into the image so the first request
# doesn't pay the download cost (and so cold containers work offline).
RUN python -c "from rapidocr_onnxruntime import RapidOCR; RapidOCR()"

COPY app ./app

EXPOSE 8080

# Bind to Cloud Run's $PORT. Single worker keeps memory low; scale via Cloud Run.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" --workers 1
