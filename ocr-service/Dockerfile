FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt functions-framework

RUN python -c "import numpy as np; from paddleocr import PaddleOCR, LayoutDetection; img=np.zeros((320,320,3),dtype='uint8'); PaddleOCR(lang='en', enable_mkldnn=False, cpu_threads=4, use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False, text_detection_model_name='PP-OCRv5_mobile_det', text_recognition_model_name='PP-OCRv5_mobile_rec').predict(img); LayoutDetection(model_name='PP-DocLayout-S', enable_mkldnn=False, cpu_threads=4).predict(img); print('models baked')"

COPY . ./

ENV FUNCTION_TARGET=ocr
CMD exec gunicorn --bind :${PORT:-8080} --workers 1 --threads 8 --timeout 0 "functions_framework:create_app()"
