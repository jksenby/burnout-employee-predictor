"""Интерпретируемые акустические признаки.

Возмущения голоса (jitter, shimmer, HNR) и высота считаются через Praat
(parselmouth), а не самодельными формулами на librosa. Что было не так раньше:

* jitter брался как mean(|diff(F0)|)/mean(F0) по массиву, из которого выброшены
  невокализованные кадры. Выбрасывание СКЛЕИВАЛО несмежные кадры, поэтому diff
  считал разность между концом одного слова и началом следующего — в «дрожание
  голоса» попадали обычные интонационные сбросы.
* shimmer считался так же по всем RMS-кадрам, ВКЛЮЧАЯ тишину. На проверке
  синтетическими сигналами он давал 0.088 и для стабильного голоса, и для
  сильно нестабильного — то есть измерял структуру паузок и не различал
  состояния вообще. Praat на тех же сигналах даёт 0.0085 / 0.0199 / 0.0405.
* hnr считался как отношение гармонической к ПЕРКУССИВНОЙ компоненте
  (librosa.effects.hpss). Шум голоса и придыхание широкополосные, но не
  перкуссивные, так что это было отношение гармоник к ударным, а не к шуму.
* speech_rate считался числом музыкальных онсетов в секунду
  (librosa.onset.onset_detect) — это не темп речи. Теперь это слоговые ядра в
  секунду: пики интенсивности, вокализованные и отделённые провалом ≥2 дБ
  (подход De Jong & Wempe).

Энергетические признаки (energy_*) остаются абсолютными RMS и потому зависят от
усиления микрофона. Это самый слабый из признаков личной нормы; убрать эту
зависимость, не потеряв сам сигнал громкости, нельзя.
"""

import numpy as np
import librosa
import parselmouth
from parselmouth.praat import call

# Версия схемы признаков. Увеличивается при ЛЮБОМ изменении способа расчёта:
# личная норма (analysis.py) сравнивает абсолютные величины, поэтому смешивать
# в одной норме записи, посчитанные разными формулами, нельзя.
#   1 — самодельные формулы на librosa (до 2026-07-31)
#   2 — Praat для F0/jitter/shimmer/HNR, слоговые ядра для темпа речи
FEATURE_SCHEMA_VERSION = 2

# Диапазон F0 для трекинга. Один и тот же используется для питча и для
# PointProcess, иначе jitter считался бы по другим периодам, чем pitch_*.
PITCH_FLOOR = 75.0
PITCH_CEILING = 600.0

# Параметры возмущений — значения по умолчанию из Praat.
_SHORTEST_PERIOD = 0.0001
_LONGEST_PERIOD = 0.02
_MAX_PERIOD_FACTOR = 1.3
_MAX_AMPLITUDE_FACTOR = 1.6

# Возмущения меряются ПОСЕГМЕНТНО по вокализованным участкам, а не по всей
# записи сразу. Причина: local shimmer — это отличие соседних периодов по
# амплитуде, и на связной речи его забивает амплитудная огибающая слога (атака
# и спад). На проверке синтетическими сигналами shimmer по всей записи давал
# 0.143 / 0.145 / 0.139 для стабильного, умеренного и нестабильного голоса, то
# есть измерял огибающую, а не голос. Praat поэтому и меряют возмущения на
# устойчивых участках. Края каждого участка обрезаются, значения по участкам
# сводятся медианой — конкатенации нет, поэтому искусственных стыков (той самой
# ошибки, что была в старой формуле) не возникает.
_VOICED_MARGIN_SEC = 0.03
_MIN_SEGMENT_SEC = 0.08

# Порог тишины: на сколько дБ ниже речевого уровня кадр считается паузой.
# Порог ОТНОСИТЕЛЬНЫЙ, поэтому pause_ratio не зависит от усиления микрофона —
# раньше порог брался как 0.01 от максимума записи, и один громкий щелчок
# поднимал его так, что вся речь записывалась в тишину.
SILENCE_DROP_DB = 25.0
# Минимальный провал интенсивности между двумя слоговыми ядрами.
SYLLABLE_DIP_DB = 2.0


def _finite(value, default: float = 0.0) -> float:
    try:
        value = float(value)
    except (TypeError, ValueError):
        return default
    return value if np.isfinite(value) else default


def _voiced_intervals(pitch) -> list:
    """Непрерывные вокализованные отрезки с обрезанными краями."""
    f0 = np.asarray(pitch.selected_array["frequency"]).ravel()
    times = np.asarray(pitch.xs()).ravel()
    if f0.size == 0:
        return []

    voiced = f0 > 0
    intervals = []
    start = None
    for i, is_voiced in enumerate(voiced):
        if is_voiced and start is None:
            start = i
        elif not is_voiced and start is not None:
            intervals.append((start, i - 1))
            start = None
    if start is not None:
        intervals.append((start, voiced.size - 1))

    trimmed = []
    for a, b in intervals:
        t0 = float(times[a]) + _VOICED_MARGIN_SEC
        t1 = float(times[b]) - _VOICED_MARGIN_SEC
        if t1 - t0 >= _MIN_SEGMENT_SEC:
            trimmed.append((t0, t1))
    return trimmed


def _voice_perturbation(snd, pitch) -> dict:
    """jitter (local), shimmer (local), HNR (cc) через Praat.

    jitter и shimmer — медиана по вокализованным отрезкам (см. комментарий к
    _VOICED_MARGIN_SEC). HNR считается по контуру: Praat сам помечает
    непериодические кадры значением -200 дБ, их достаточно отфильтровать.
    """
    point_process = call(snd, "To PointProcess (periodic, cc)", PITCH_FLOOR, PITCH_CEILING)
    segments = _voiced_intervals(pitch)

    jitters, shimmers = [], []
    for t0, t1 in segments:
        jitter = _finite(call(
            point_process, "Get jitter (local)",
            t0, t1, _SHORTEST_PERIOD, _LONGEST_PERIOD, _MAX_PERIOD_FACTOR,
        ), default=np.nan)
        shimmer = _finite(call(
            [snd, point_process], "Get shimmer (local)",
            t0, t1, _SHORTEST_PERIOD, _LONGEST_PERIOD,
            _MAX_PERIOD_FACTOR, _MAX_AMPLITUDE_FACTOR,
        ), default=np.nan)
        if np.isfinite(jitter):
            jitters.append(jitter)
        if np.isfinite(shimmer):
            shimmers.append(shimmer)

    if not jitters:
        # Ни одного пригодного отрезка — считаем по всей записи, чтобы не
        # отдавать ноль там, где голос всё-таки есть.
        jitters = [_finite(call(
            point_process, "Get jitter (local)",
            0, 0, _SHORTEST_PERIOD, _LONGEST_PERIOD, _MAX_PERIOD_FACTOR,
        ))]
    if not shimmers:
        shimmers = [_finite(call(
            [snd, point_process], "Get shimmer (local)",
            0, 0, _SHORTEST_PERIOD, _LONGEST_PERIOD,
            _MAX_PERIOD_FACTOR, _MAX_AMPLITUDE_FACTOR,
        ))]

    harmonicity = call(snd, "To Harmonicity (cc)", 0.01, PITCH_FLOOR, 0.1, 1.0)
    values = np.asarray(harmonicity.values).ravel()
    # -200 дБ — заполнитель Praat для кадров без периодичности.
    voiced_hnr = values[values > -180.0]

    return {
        "jitter": _finite(np.median(jitters)),
        "shimmer": _finite(np.median(shimmers)),
        "hnr": _finite(np.mean(voiced_hnr)) if voiced_hnr.size else 0.0,
        "voiced_segments": float(len(segments)),
    }


def _intensity_contour(snd) -> tuple:
    """Контур интенсивности в дБ + относительный порог тишины."""
    intensity = snd.to_intensity(minimum_pitch=50.0)
    values = np.asarray(intensity.values).ravel()
    times = np.asarray(intensity.xs()).ravel()

    if values.size == 0:
        return values, times, 0.0

    # Речевой уровень — 95-й процентиль, устойчивый к отдельным выбросам.
    speech_level = float(np.percentile(values, 95))
    threshold = max(speech_level - SILENCE_DROP_DB, float(np.min(values)))
    return values, times, threshold


def _syllable_rate(pitch, values, times, threshold, duration) -> float:
    """Слоговые ядра в секунду.

    Ядром считается локальный максимум интенсивности, который (а) выше порога
    тишины, (б) вокализован, (в) отделён от предыдущего принятого ядра провалом
    не менее SYLLABLE_DIP_DB — иначе это тот же слог.
    """
    if values.size < 3 or duration <= 0:
        return 0.0

    accepted = []
    for i in range(1, values.size - 1):
        if values[i] <= threshold:
            continue
        if not (values[i] >= values[i - 1] and values[i] > values[i + 1]):
            continue

        f0 = pitch.get_value_at_time(float(times[i]))
        if f0 is None or not np.isfinite(f0) or f0 <= 0:
            continue

        if not accepted:
            accepted.append(i)
            continue

        previous = accepted[-1]
        valley = float(np.min(values[previous:i + 1]))
        if min(values[previous], values[i]) - valley >= SYLLABLE_DIP_DB:
            accepted.append(i)
        elif values[i] > values[previous]:
            # Тот же слог, но настоящий пик правее — сдвигаем, а не добавляем.
            accepted[-1] = i

    return len(accepted) / duration


def extract_acoustic_features(y: np.ndarray, sr: int) -> dict:
    """Признаки по уже декодированному моно-сигналу (см. audio_io.decode_audio)."""
    try:
        duration = len(y) / sr if sr else 0.0
        snd = parselmouth.Sound(np.asarray(y, dtype=np.float64), sampling_frequency=sr)

        features = {}

        pitch = call(snd, "To Pitch", 0.0, PITCH_FLOOR, PITCH_CEILING)
        f0 = np.asarray(pitch.selected_array["frequency"]).ravel()
        voiced = f0[f0 > 0]
        total_frames = max(f0.size, 1)

        # voiced_fraction — метрика качества записи, не признак модели.
        # main.py по ней отклоняет шум, музыку и шёпот (audio_io.validate_voicing).
        features["voiced_fraction"] = float(voiced.size / total_frames)
        features["duration_sec"] = float(duration)

        if voiced.size:
            features["pitch_mean"] = float(np.mean(voiced))
            features["pitch_std"] = float(np.std(voiced))
            features["pitch_range"] = float(np.ptp(voiced))
            features["pitch_median"] = float(np.median(voiced))
        else:
            features["pitch_mean"] = 0.0
            features["pitch_std"] = 0.0
            features["pitch_range"] = 0.0
            features["pitch_median"] = 0.0

        rms = librosa.feature.rms(y=y)[0]
        features["energy_mean"] = float(np.mean(rms))
        features["energy_std"] = float(np.std(rms))
        features["energy_max"] = float(np.max(rms)) if rms.size else 0.0

        features.update(_voice_perturbation(snd, pitch))

        intensity_values, intensity_times, silence_threshold = _intensity_contour(snd)
        features["speech_rate"] = _syllable_rate(
            pitch, intensity_values, intensity_times, silence_threshold, duration
        )
        features["pause_ratio"] = (
            float(np.mean(intensity_values <= silence_threshold))
            if intensity_values.size else 0.0
        )

        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        features["spectral_centroid_mean"] = float(np.mean(centroid))
        features["spectral_centroid_std"] = float(np.std(centroid))

        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        for i in range(13):
            features[f"mfcc_{i}_mean"] = float(np.mean(mfccs[i]))
            features[f"mfcc_{i}_std"] = float(np.std(mfccs[i]))

        features = {k: _finite(v) for k, v in features.items()}

        print(
            f"Acoustic features (schema v{FEATURE_SCHEMA_VERSION}): "
            f"F0={features['pitch_mean']:.0f}±{features['pitch_std']:.0f} Hz, "
            f"jitter={features['jitter']:.4f}, shimmer={features['shimmer']:.4f}, "
            f"HNR={features['hnr']:.1f} dB, "
            f"{features['speech_rate']:.1f} syl/s, "
            f"pauses={features['pause_ratio'] * 100:.0f}%, "
            f"voiced={features['voiced_fraction'] * 100:.0f}%"
        )
        return features

    except Exception as e:
        print(f"Error extracting acoustic features: {e}")
        raise
