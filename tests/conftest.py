import os
import sys

import numpy as np
import pytest

# Модули лежат в корне репозитория, а не в пакете.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


@pytest.fixture
def sr():
    return 16000


@pytest.fixture
def voiced_signal(sr):
    """Синтетический «голос»: гармонический сигнал с плавающим F0 и паузами.

    Модуляция F0 нужна, чтобы pitch_std был ненулевым, паузы — чтобы
    pause_ratio и темп речи считались по-настоящему.
    """
    duration = 6.0
    t = np.arange(int(duration * sr)) / sr
    f0 = 140.0 + 20.0 * np.sin(2 * np.pi * 0.5 * t)
    phase = 2 * np.pi * np.cumsum(f0) / sr
    y = sum(np.sin(k * phase) / k for k in range(1, 6))
    # Слоги ~4 Гц и паузы каждые полторы секунды.
    envelope = 0.5 + 0.5 * np.sin(2 * np.pi * 4.0 * t) ** 2
    envelope[(t % 1.5) > 1.2] = 0.0
    y = 0.2 * y * envelope / np.max(np.abs(y))
    return y.astype(np.float32)


@pytest.fixture
def stable_session():
    """Типичные значения acoustic_features для одной сессии."""
    return {
        "pitch_std": 25.0,
        "pitch_range": 150.0,
        "energy_mean": 0.05,
        "speech_rate": 4.0,
        "hnr": 15.0,
        "pause_ratio": 0.25,
        "jitter": 0.015,
        "shimmer": 0.08,
    }
