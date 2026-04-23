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
import numpy as np
import soundfile as sf
import io

_whisper_model = None


def _load_model():
    global _whisper_model
    if _whisper_model is None:
        print("Loading Faster-Whisper model (large-v3)...")
        _whisper_model = WhisperModel("large-v3", device="auto", compute_type="float32")
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

        segments, info = model.transcribe(audio, beam_size=5)
        text = " ".join([segment.text for segment in segments]).strip()

        print(f"Faster-Whisper transcription ({len(text.split())} words): "
              f"{text[:80]}{'...' if len(text) > 80 else ''}")

        return text

    except Exception as e:
        print(f"Error in Whisper transcription: {e}")
        raise
