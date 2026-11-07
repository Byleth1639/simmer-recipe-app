import hmac
import os
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field
from engine import ImageEngine, Generation

engine = ImageEngine()
capacity = threading.BoundedSemaphore(1)

def require_token(authorization: str = Header(default='')):
    expected = os.getenv('SD_SERVICE_TOKEN', '')
    supplied = authorization.removeprefix('Bearer ')
    if len(expected) < 32:
        raise HTTPException(503, 'Set SD_SERVICE_TOKEN to at least 32 characters.')
    if not authorization.startswith('Bearer ') or not hmac.compare_digest(supplied.encode(), expected.encode()):
        raise HTTPException(401, 'Invalid service token.')

def preload():
    try:
        engine.load()
    except Exception as error:
        engine.loading_error = str(error)
        print('Model warmup failed; check model access and memory:', type(error).__name__, flush=True)

@asynccontextmanager
async def lifespan(_app):
    if os.getenv('PRELOAD_MODEL', '0') == '1':
        threading.Thread(target=preload, daemon=True).start()
    yield

app = FastAPI(title='Simmer Stable Diffusion service', lifespan=lifespan)

class ImageRequest(BaseModel):
    prompt: str = Field(min_length=20, max_length=1600)
    seed: int = Field(default=42, ge=0, le=2147483647)
    steps: int = Field(default=25, ge=10, le=40)

@app.get('/health')
def health():
    return {'ok': True, 'modelLoaded': engine.pipeline is not None, 'warmupFailed': bool(engine.loading_error)}

@app.post('/generate', dependencies=[Depends(require_token)])
def generate(request: ImageRequest):
    if not capacity.acquire(blocking=False):
        raise HTTPException(429, 'The image model is busy. Try again shortly.')
    try:
        data = engine.generate(Generation(request.prompt, request.seed, request.steps))
        return Response(content=data, media_type='image/png', headers={'Cache-Control': 'no-store'})
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    except Exception as error:
        print('Generation error:', type(error).__name__, flush=True)
        raise HTTPException(503, 'Image generation failed. Check model access, device and available memory.') from error
    finally:
        capacity.release()
