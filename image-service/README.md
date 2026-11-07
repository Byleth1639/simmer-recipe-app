---
title: Simmer Image Service
emoji: 🍲
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
---

# Simmer Stable Diffusion image service

This is a separate Python service. It runs a **pretrained Stable Diffusion v1.5 model with Hugging Face Diffusers**, using a **fastai Learner inference adapter** to execute and gather image predictions. No training or fine-tuning is performed.

Copy this folder's `Dockerfile`, `requirements.txt`, `app.py`, `engine.py` and this `README.md` into a Docker Space repository (with these files at its root). Set `SD_SERVICE_TOKEN` in the Space's secrets to the same random value used by your Node server. `DEVICE=auto` chooses CUDA when available and otherwise uses CPU. GPU hosting is recommended; CPU generation is much slower. Do not run this model inside the small Render Node web service.

The public `/health` endpoint reports `modelLoaded`. The first model download can take several minutes. With `PRELOAD_MODEL=1`, warmup happens in the background; wait for `modelLoaded: true` before generating photos. If `warmupFailed` is true, check the host logs, memory and model access. Model weights live in the Hugging Face cache; persistence depends on the host's storage configuration.

`POST /generate` requires `Authorization: Bearer <SD_SERVICE_TOKEN>` and JSON with `prompt`, `seed` and `steps`. It returns actual PNG bytes, never a mock placeholder. Only one generation runs at a time. The diffusion model's safety checker stays enabled.

For local CPU development with Python 3.12:

```sh
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install torch==2.15.0 torchvision==0.29.2 --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements-dev.txt
```

Set environment variables from `.env.example` in your terminal (or start Uvicorn with `--env-file .env` after installing `python-dotenv`), then run:

```sh
uvicorn app:app --host 0.0.0.0 --port 7860 --workers 1
```

Tests:

```sh
python -m pytest -q
```

The tests exercise the real fastai inference adapter with a tiny deterministic test pipeline, plus HTTP authentication, request validation and safety-check rejection. They do not download Stable Diffusion weights or prove GPU compatibility. Run a real photo generation after deploying and configuring your own service.

Model card/license: https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5
