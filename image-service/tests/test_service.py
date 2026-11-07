import io
from types import SimpleNamespace
import numpy as np
import pytest
from PIL import Image
from fastapi.testclient import TestClient
import app as service
from engine import Generation, fastai_generate

TOKEN = 'test-service-token-' + 'x' * 32

class ToyPipeline:
    """Tests the real fastai inference adapter without downloading model weights."""
    def __init__(self, blocked=False):
        self.blocked = blocked
        self.calls = []
    def __call__(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(images=np.full((1, 8, 8, 3), 0.5, dtype=np.float32), nsfw_content_detected=[self.blocked])

def test_fastai_adapter_runs_pipeline_and_returns_real_png():
    pipeline = ToyPipeline()
    data = fastai_generate(pipeline, Generation('A warm bowl of chickpea soup in natural light', 17, 10))
    assert Image.open(io.BytesIO(data)).size == (8, 8)
    assert pipeline.calls[0]['prompt'].startswith('A warm bowl')
    assert pipeline.calls[0]['generator'].initial_seed() == 17

def test_safety_checker_rejection_is_not_published():
    with pytest.raises(ValueError):
        fastai_generate(ToyPipeline(blocked=True), Generation('A warm bowl of soup'))

def test_http_auth_validation_and_inference(monkeypatch):
    monkeypatch.setenv('SD_SERVICE_TOKEN', TOKEN)
    monkeypatch.setattr(service.engine, 'generate', lambda req: fastai_generate(ToyPipeline(), req))
    with TestClient(service.app) as client:
        assert client.get('/health').status_code == 200
        body = {'prompt': 'A warm bowl of tomato pasta in natural light'}
        assert client.post('/generate', json=body).status_code == 401
        assert client.post('/generate', json={'prompt': 'tiny'}, headers={'Authorization': 'Bearer '+TOKEN}).status_code == 422
        response = client.post('/generate', json=body, headers={'Authorization': 'Bearer '+TOKEN})
        assert response.status_code == 200
        assert response.headers['content-type'] == 'image/png'
        assert response.content.startswith(b'\x89PNG')
