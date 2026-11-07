FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 HF_HOME=/home/app/.cache/huggingface TOKENIZERS_PARALLELISM=false
RUN useradd -m -u 1000 app
WORKDIR /home/app/service
COPY requirements.txt ./
# PyPI's standard PyTorch distribution supports CUDA on compatible GPU hosts.
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=app:app app.py engine.py ./
USER app
ENV PORT=7860 DEVICE=auto PRELOAD_MODEL=1
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-7860} --workers 1"]
