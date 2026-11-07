"""Pretrained Stable Diffusion, executed through a real fastai Learner inference loop.
No model training or fine-tuning is claimed by this application.
"""
import io
import os
import threading
from dataclasses import dataclass
import numpy as np
import torch
from torch import nn
from PIL import Image
from fastai.data.core import DataLoaders, TfmdDL
from fastai.learner import Learner

@dataclass(frozen=True)
class Generation:
    prompt: str
    seed: int = 42
    steps: int = 25

class DiffusionBatch(nn.Module):
    """Adapt Diffusers' image output to fastai's tensor prediction/gathering protocol."""
    def __init__(self, pipeline, request: Generation, device: str):
        super().__init__()
        self.anchor = nn.Parameter(torch.zeros(1, device=device), requires_grad=False)
        self.pipeline = pipeline
        self.request = request
        self.device_name = device
        self.blocked = False

    def forward(self, _batch):
        generator_device = 'cuda' if self.device_name == 'cuda' else 'cpu'
        result = self.pipeline(
            prompt=self.request.prompt,
            negative_prompt='text, watermark, logo, person, hands, illustration, deformed food, blurry, raw uncooked poultry',
            num_inference_steps=self.request.steps,
            guidance_scale=7.0,
            width=512, height=512,
            generator=torch.Generator(device=generator_device).manual_seed(self.request.seed),
            output_type='np',
        )
        self.blocked = any(result.nsfw_content_detected or [])
        # Prediction tensors are gathered by Learner.get_preds rather than returning a fabricated result.
        return torch.from_numpy(np.asarray(result.images, dtype=np.float32)).permute(0, 3, 1, 2).to(self.anchor.device)

def fastai_generate(pipeline, request: Generation, device='cpu') -> bytes:
    model = DiffusionBatch(pipeline, request, device)
    # Input-only batches: this is inference, not an optimization/training dataset.
    dl = TfmdDL([(torch.zeros(1),)], bs=1, num_workers=0, device=torch.device(device))
    dls = DataLoaders(dl, dl, device=torch.device(device))
    learn = Learner(dls, model, loss_func=lambda *_: torch.tensor(0.0), default_cbs=False)
    predictions, _ = learn.get_preds(dl=dl, act=lambda x: x, reorder=False)
    if model.blocked:
        raise ValueError('The model safety checker declined this image.')
    array = predictions[0].permute(1, 2, 0).clamp(0, 1).mul(255).round().to(torch.uint8).cpu().numpy()
    output = io.BytesIO()
    Image.fromarray(array).save(output, format='PNG')
    return output.getvalue()

class ImageEngine:
    def __init__(self):
        self.pipeline = None
        self.device = 'cpu'
        self.loading_error = None
        self._load_lock = threading.Lock()

    def load(self):
        with self._load_lock:
            if self.pipeline is not None:
                return
            from diffusers import StableDiffusionPipeline
            requested = os.getenv('DEVICE', 'auto')
            self.device = ('cuda' if torch.cuda.is_available() else 'cpu') if requested == 'auto' else requested
            if self.device == 'cuda' and not torch.cuda.is_available():
                raise RuntimeError('DEVICE=cuda was requested but CUDA is unavailable.')
            if self.device not in ('cpu', 'cuda', 'mps'):
                raise RuntimeError('DEVICE must be auto, cpu, cuda or mps.')
            dtype = torch.float16 if self.device == 'cuda' else torch.float32
            self.pipeline = StableDiffusionPipeline.from_pretrained(
                os.getenv('MODEL_ID', 'stable-diffusion-v1-5/stable-diffusion-v1-5'),
                torch_dtype=dtype, use_safetensors=True, token=os.getenv('HF_TOKEN') or None,
            ).to(self.device)
            self.pipeline.enable_attention_slicing()
            self.pipeline.set_progress_bar_config(disable=True)

    def generate(self, request: Generation) -> bytes:
        self.load()
        return fastai_generate(self.pipeline, request, self.device)
