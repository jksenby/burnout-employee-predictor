"""Единое декодирование и валидация входного аудио.

Зачем нужна отдельная валидация: личная норма голоса (analysis.py) ФИКСИРУЕТСЯ
по первым сессиям пользователя и дальше не пересчитывается. Одна битая или
слишком короткая запись, попавшая в калибровку, портит референс навсегда — все
последующие отклонения будут считаться от мусора. Поэтому запись, по которой
нельзя надёжно посчитать просодию, должна отклоняться до сохранения, а не
молча превращаться в нули.
"""

import io

import numpy as np
import soundfile as sf

TARGET_SR = 16000

# Ниже этого просодия недостоверна: Praat нужно достаточно периодов F0, а
# pause_ratio и темп речи на двух словах вырождаются.
MIN_DURATION_SEC = 5.0
# Записи длиннее прогоняются четырьмя нейросетями и Whisper — ограничиваем,
# чтобы один запрос не занимал процесс на десятки минут.
MAX_DURATION_SEC = 600.0
# Предел на объём до декодирования: длительность без декодирования не узнать, а
# `await file.read()` тянет файл в память целиком.
MAX_UPLOAD_BYTES = 100 * 1024 * 1024

# Практически тишина: запись не содержит речи.
MIN_RMS = 1e-4
# Доля отсчётов на пределе шкалы, выше которой запись считается клиппированной —
# клиппинг ломает и амплитудные, и спектральные признаки.
MAX_CLIPPED_RATIO = 0.02
# Минимальная доля вокализованных кадров. Проверяется уже после извлечения
# признаков (нужен F0), поэтому живёт здесь только как константа.
MIN_VOICED_FRACTION = 0.15


class AudioValidationError(ValueError):
    """Запись непригодна для анализа. Наверх уходит как 400, а не 500."""


def decode_audio(audio_bytes: bytes) -> tuple:
    """Декодирует в моно float32 на TARGET_SR. Возвращает (y, sr)."""
    if not audio_bytes:
        raise AudioValidationError("Файл пустой.")
    if len(audio_bytes) > MAX_UPLOAD_BYTES:
        raise AudioValidationError(
            f"Файл больше {MAX_UPLOAD_BYTES // (1024 * 1024)} МБ."
        )

    try:
        y, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32")
    except Exception as exc:
        raise AudioValidationError(
            f"Не удалось прочитать аудио: {exc}. Поддерживаются WAV, FLAC, OGG."
        ) from exc

    if y.ndim > 1:
        y = y.mean(axis=1)

    if sr != TARGET_SR:
        import librosa
        y = librosa.resample(y, orig_sr=sr, target_sr=TARGET_SR)
        sr = TARGET_SR

    return np.ascontiguousarray(y, dtype=np.float32), sr


def validate_audio(y: np.ndarray, sr: int) -> dict:
    """Дешёвые проверки до запуска нейросетей. Бросает AudioValidationError."""
    duration = len(y) / sr if sr else 0.0

    if duration < MIN_DURATION_SEC:
        raise AudioValidationError(
            f"Запись слишком короткая ({duration:.1f} с). "
            f"Нужно минимум {MIN_DURATION_SEC:.0f} с непрерывной речи — "
            "на меньшей длительности просодические признаки недостоверны."
        )
    if duration > MAX_DURATION_SEC:
        raise AudioValidationError(
            f"Запись слишком длинная ({duration / 60:.1f} мин). "
            f"Максимум {MAX_DURATION_SEC / 60:.0f} мин."
        )

    rms = float(np.sqrt(np.mean(np.square(y)))) if len(y) else 0.0
    if rms < MIN_RMS:
        raise AudioValidationError(
            "В записи практически нет звука. Проверьте микрофон."
        )

    clipped_ratio = float(np.mean(np.abs(y) >= 0.999)) if len(y) else 0.0
    if clipped_ratio > MAX_CLIPPED_RATIO:
        raise AudioValidationError(
            f"Запись перегружена по уровню ({clipped_ratio * 100:.1f}% отсчётов "
            "на пределе шкалы). Уменьшите усиление микрофона и повторите."
        )

    return {"duration_sec": duration, "rms": rms, "clipped_ratio": clipped_ratio}


def validate_voicing(voiced_fraction: float) -> None:
    """Проверка после извлечения F0: есть ли в записи собственно голос.

    Отделена от validate_audio, потому что требует F0-трекинга. Ловит случаи,
    которые проходят проверку по громкости: шум, музыку, шёпот, тишину с щелчками.
    """
    if voiced_fraction < MIN_VOICED_FRACTION:
        raise AudioValidationError(
            f"В записи слишком мало голоса (вокализовано {voiced_fraction * 100:.0f}% "
            f"кадров, нужно минимум {MIN_VOICED_FRACTION * 100:.0f}%). "
            "Возможно, вместо речи записался шум или запись слишком тихая."
        )
