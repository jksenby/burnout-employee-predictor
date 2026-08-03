import os
import shutil

# ── Windows symlink fix ──────────────────────────────────────────────────────
# Windows requires Developer Mode or admin rights to create symlinks.
# HuggingFace Hub uses symlinks internally for its cache system.
# We patch os.symlink to fall back to a plain file copy on failure,
# so the HF cache works without any special Windows permissions.
_orig_symlink = os.symlink


def _safe_symlink(src, dst, target_is_directory=False, dir_fd=None):
    try:
        _orig_symlink(src, dst, target_is_directory=target_is_directory, dir_fd=dir_fd)
    except OSError:
        # Resolve relative symlink src (HF uses relative paths like ../../blobs/...)
        if not os.path.isabs(src):
            src = os.path.normpath(os.path.join(os.path.dirname(dst), src))
        shutil.copy2(src, dst)


os.symlink = _safe_symlink
# ────────────────────────────────────────────────────────────────────────────

from faster_whisper import WhisperModel
import ctranslate2
import numpy as np
import soundfile as sf
import io

_whisper_model = None

# Path to a CTranslate2-converted, Kazakh/Russian fine-tuned model
# (see scripts/convert_whisper_model.py). Used automatically when present.
_FINETUNED_DIR = os.path.join(os.path.dirname(__file__), "models", "whisper-kazrus-ct2")


def _resolve_config():
    """Pick model / device / compute_type. Env vars override; otherwise we
    auto-detect a CUDA GPU (via CTranslate2, not torch) and prefer the
    fine-tuned model when it has been converted locally."""
    has_gpu = ctranslate2.get_cuda_device_count() > 0

    model = os.environ.get("WHISPER_MODEL")
    if model is None:
        model = _FINETUNED_DIR if os.path.isdir(_FINETUNED_DIR) else "large-v3"

    device = os.environ.get("WHISPER_DEVICE") or ("cuda" if has_gpu else "cpu")
    compute_type = os.environ.get("WHISPER_COMPUTE_TYPE") or (
        "float16" if device == "cuda" else "int8"
    )
    return model, device, compute_type


def _load_model():
    global _whisper_model
    if _whisper_model is None:
        model, device, compute_type = _resolve_config()
        print(f"Loading Faster-Whisper model ({model}, {compute_type}, {device})...")
        _whisper_model = WhisperModel(model, device=device, compute_type=compute_type)
        print("Faster-Whisper model loaded")
    return _whisper_model


def _load_audio_from_bytes(audio_bytes: bytes, target_sr: int = 16000) -> np.ndarray:
    audio_buffer = io.BytesIO(audio_bytes)
    y, sr = sf.read(audio_buffer, dtype="float32")

    if len(y.shape) > 1:
        y = y.mean(axis=1)

    if sr != target_sr:
        import torch
        import torchaudio
        y_tensor = torch.tensor(y).unsqueeze(0)
        resampler = torchaudio.transforms.Resample(sr, target_sr)
        y = resampler(y_tensor).squeeze(0).numpy()

    return y.astype(np.float32)


def transcribe_bytes(audio_bytes: bytes) -> str:
    try:
        model = _load_model()

        audio = _load_audio_from_bytes(audio_bytes, target_sr=16000)

        # beam_size=5 (vs greedy=1) and VAD filtering improve accuracy on
        # noisy / multi-language audio; language is left unset for KZ/RU/EN
        # auto-detection per utterance.
        segments, info = model.transcribe(audio, beam_size=5, vad_filter=True)
        text = " ".join([segment.text for segment in segments]).strip()

        print(f"Faster-Whisper transcription ({len(text.split())} words): "
              f"{text[:80]}{'...' if len(text) > 80 else ''}")

        return text

    except Exception as e:
        print(f"Error in Whisper transcription: {e}")
        raise
