import whisper
import numpy as np
import soundfile as sf
import io
import tempfile
import os

_whisper_model = None


def _load_model():
    global _whisper_model
    if _whisper_model is None:
        print("Loading Whisper model...")
        _whisper_model = whisper.load_model("large-v3")
        print("Whisper model loaded")
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

        result = model.transcribe(audio, fp16=False)
        text = result["text"].strip()

        print(f"Whisper transcription ({len(text.split())} words): "
              f"{text[:80]}{'...' if len(text) > 80 else ''}")

        return text

    except Exception as e:
        print(f"Error in Whisper transcription: {e}")
        raise
