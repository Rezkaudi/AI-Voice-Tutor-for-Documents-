"""FastAPI entrypoint. Run: uvicorn app.main:app --port 8000"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager

import anyio
from fastapi import FastAPI

from app.api.routes import router
from app.config import settings
from app.container import registry
from app.logging_config import configure_logging, get_logger

configure_logging()
log = get_logger("startup")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    log.info(
        "booting · engines=%s · max_concurrency=%d · intra_threads=%d · rec_batch=%d",
        registry.names(),
        settings.max_concurrency,
        settings.intra_threads,
        settings.rec_batch_num,
    )
    # Pay the ONNX Runtime cold-start now so the first real request is fast.
    if settings.warmup:
        for engine in registry.all():
            warmup = getattr(engine, "warmup", None)
            if not callable(warmup):
                continue
            started = time.perf_counter()
            log.info("warming up '%s' (loading models + first inference)…", engine.name)
            await anyio.to_thread.run_sync(warmup)
            log.info("'%s' ready in %.0fms", engine.name, (time.perf_counter() - started) * 1000)
    log.info("✅ startup complete — ready to serve /ocr")
    yield
    log.info("shutting down")


app = FastAPI(title="OCR Service", version="1.0.0", lifespan=lifespan)
app.include_router(router)


def run() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host=settings.host, port=settings.port)


if __name__ == "__main__":
    run()
