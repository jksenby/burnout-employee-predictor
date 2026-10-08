"""Декодирование, валидация и акустические признаки (audio_io.py, feature_extraction.py)."""

import io

import numpy as np
import pytest
import soundfile as sf

from audio_io import (
    AudioValidationError, TARGET_SR, decode_audio, validate_audio, validate_voicing,
)
from feature_extraction import extract_acoustic_features


def _wav_bytes(y, sr):
    buf = io.BytesIO()
    sf.write(buf, y, sr, format="WAV")
    return buf.getvalue()


def test_decode_resamples_and_downmixes(voiced_signal):
    stereo = np.stack([voiced_signal, voiced_signal], axis=1)
    y, sr = decode_audio(_wav_bytes(stereo, 44100))

    assert sr == TARGET_SR
    assert y.ndim == 1
    assert y.dtype == np.float32
    assert len(y) == pytest.approx(len(voiced_signal) * TARGET_SR / 44100, rel=0.01)


@pytest.mark.parametrize("payload", [b"", b"definitely not audio"])
def test_decode_rejects_bad_input(payload):
    with pytest.raises(AudioValidationError):
        decode_audio(payload)


def test_validate_accepts_normal_recording(voiced_signal, sr):
    info = validate_audio(voiced_signal, sr)

    assert info["duration_sec"] == pytest.approx(6.0)


def test_validate_rejects_short(voiced_signal, sr):
    with pytest.raises(AudioValidationError, match="короткая"):
        validate_audio(voiced_signal[: 2 * sr], sr)


def test_validate_rejects_silence(sr):
    with pytest.raises(AudioValidationError, match="нет звука"):
        validate_audio(np.zeros(6 * sr, dtype=np.float32), sr)


def test_validate_rejects_clipping(sr):
    with pytest.raises(AudioValidationError, match="перегружена"):
        validate_audio(np.ones(6 * sr, dtype=np.float32), sr)


def test_validate_voicing_threshold():
    validate_voicing(0.5)
    with pytest.raises(AudioValidationError):
        validate_voicing(0.05)


def test_acoustic_features_on_synthetic_voice(voiced_signal, sr):
    feats = extract_acoustic_features(voiced_signal, sr)

    # F0 синтетического сигнала колеблется в 120–160 Гц.
    assert 115 < feats["pitch_mean"] < 165
    assert feats["pitch_std"] > 5
    assert feats["voiced_fraction"] > 0.5
    assert 0 < feats["pause_ratio"] < 1
    assert len([k for k in feats if k.startswith("mfcc_")]) == 26
    assert all(np.isfinite(v) for v in feats.values())


def test_noise_is_mostly_unvoiced(sr):
    rng = np.random.default_rng(0)
    noise = (0.1 * rng.standard_normal(6 * sr)).astype(np.float32)
    feats = extract_acoustic_features(noise, sr)

    assert feats["voiced_fraction"] < 0.15
