"""Личная акустическая норма (baseline) и лонгитюдное отклонение от неё.

Зачем это нужно отдельно от model.py:

Классификатор в model.py — СНИМОК: одна запись → одна оценка. Он работает с
абсолютными величинами (pitch, energy, HNR, MFCC), а они на порядок сильнее
зависят от пола, возраста, микрофона и помещения, чем от состояния говорящего.
Поэтому сравнивать абсолютный скор двух разных людей некорректно, а строить по
нему динамику за месяц — тем более: разница между двумя записями будет в
основном отражать смену микрофона и время суток, а не выгорание.

Этот модуль даёт второй, независимый сигнал: насколько текущая запись
отклоняется от СОБСТВЕННОЙ нормы того же человека, измеренной в том же режиме
(интервью / чтение). Он ни на чём не обучен — ни на реальных данных, ни на
синтетических из train.py: это чистое сравнение человека с самим собой, и
именно он отвечает на вопрос «что изменилось за период наблюдения».

Схема работы:
  1. Первые BASELINE_WINDOW_SESSIONS сессий пользователя в данном режиме —
     калибровочные. По ним считаются медиана и робастный разброс (MAD).
  2. Норма ФИКСИРУЕТСЯ и дальше не пересчитывается. Скользящее окно тут не
     годится: оно постепенно «впитывает» медленный дрейф и именно тот сдвиг,
     который мы хотим поймать, становится новой нормой.
  3. Каждая следующая запись переводится в знаковые z-оценки относительно этой
     нормы, где положительное значение всегда означает «хуже».
"""

import math

# Направление признака: +1 — рост означает больший риск, -1 — падение означает
# больший риск. Набор ограничен признаками, которые реально сохраняются в
# SpeechAnalysis.acoustic_features (см. _run_speech_pipeline в main.py).
RISK_DIRECTION = {
    "pitch_std": -1,     # падение вариативности F0 = монотонная речь
    "pitch_range": -1,   # сужение диапазона = уплощение просодии
    "energy_mean": -1,   # тише = меньше сил
    "speech_rate": -1,   # медленнее = заторможенность
    "hnr": -1,           # ниже отношение гармоник к шуму = «сиплый» голос
    "pause_ratio": +1,   # больше пауз = труднее говорить
    "jitter": +1,        # нестабильность периода F0 = утомление гортани
    "shimmer": +1,       # нестабильность амплитуды
}

BASELINE_FEATURE_KEYS = tuple(RISK_DIRECTION)

# Минимум сессий, без которого норма не считается осмысленной.
MIN_BASELINE_SESSIONS = 3
# Сколько первых сессий образуют калибровочное окно.
BASELINE_WINDOW_SESSIONS = 5
# Минимум признаков в норме. deviation_score — СРЕДНЕЕ по доступным признакам,
# и среднее по двум шумным величинам куда менее устойчиво, чем по шести. Порог
# нужен именно потому, что MIN_PLAUSIBLE_MEDIAN может выбросить часть признаков:
# на вырожденной записи норма формально построится, но сравнивать будет нечем.
MIN_BASELINE_FEATURES = 4

# MAD → сигма для нормального распределения.
MAD_TO_SIGMA = 1.4826

# Нижняя граница «сигмы» — в СОБСТВЕННЫХ единицах каждого признака.
# Калибровочных точек всего 3–5, они легко могут оказаться почти одинаковыми;
# тогда MAD вырождается и любой нормальный разброс выглядит катастрофой. Пол
# означает: сдвиг меньше указанного никогда не считается более чем одной сигмой.
#
# Раньше пол был ОДИН и относительный — 8% от медианы. Он оказался намного уже
# реальной межсессионной изменчивости: у jitter медиана порядка 0.001, поэтому
# 8% давали пол 0.00008, и переход 0.0010 → 0.0014 (физиологически ничто) давал
# z = 5.0, то есть упирался в Z_CLIP. Из-за этого запись, акустически
# идентичная калибровочным, получала отклонение +0.36 («хуже нормы»), а реально
# деградированные записи — +0.21 и +0.12: порядок оценок выходил обратным.
#
# Значения ниже — типичный разброс ОДНОГО говорящего между сессиями, а не
# разброс между людьми.
ABS_SCALE_FLOOR = {
    "pitch_std": 3.0,       # Гц
    "pitch_range": 20.0,    # Гц; шумный — определяется единичными кадрами
    "energy_mean": 0.01,    # RMS; усиление микрофона двигает его сильнее
    "speech_rate": 0.4,     # слог/с
    "hnr": 1.5,             # дБ
    "pause_ratio": 0.05,    # доля
    "jitter": 0.003,        # доля (local jitter связной речи ≈0.01–0.02)
    "shimmer": 0.015,       # доля (local shimmer ≈0.05–0.12)
}
# Резервный относительный пол для признаков, которых нет в таблице выше.
REL_SCALE_FLOOR = 0.08

# Медиана ниже этой — признак в норму не берётся. У живой речи таких значений
# не бывает, значит запись вырожденная: синтезированный тон с постоянным F0
# даёт pitch_std ≈0.1 Гц, а Praat возвращает ровно 0, когда не нашёл ни одного
# пригодного периода. Сравнивать реальную речь с такой «нормой» бессмысленно, и
# calculate_burnout_deltas к тому же делит на эту медиану.
MIN_PLAUSIBLE_MEDIAN = {
    "pitch_std": 2.0,       # Гц
    "pitch_range": 10.0,    # Гц
    "speech_rate": 0.5,     # слог/с
    "energy_mean": 1e-4,    # RMS; ниже — тишина
    "jitter": 1e-4,         # не физиологический предел, а «измерение состоялось»
    "shimmer": 1e-4,
}

# Потолок z по ОДНОМУ признаку, чтобы единственный выброс не утащил оценку.
Z_CLIP = 5.0
# Масштаб мягкого сжатия. Средний сдвиг в 1 сигму даёт ≈0.46, в 2 сигмы ≈0.76,
# в 3 сигмы ≈0.90. Раньше здесь было жёсткое деление на Z_CLIP: оценка упиралась
# в ровно 1.000 и переставала различать «ухудшается» и «уже давно плохо».
Z_SOFT = 2.0

# Пороги маркера «голос стал монотоннее и нестабильнее» — исходная эвристика
# этого модуля, теперь с ключами, которые действительно отдаёт
# feature_extraction.extract_acoustic_features (pitch_std, а не f0_std).
MONOTONY_DROP = -0.20
JITTER_RISE = 0.15

# Порог, с которого отклонение называется сдвигом: tanh(x/2) = 0.20 отвечает
# среднему сдвигу ≈0.4 сигмы по всем признакам сразу.
DEVIATION_NOTABLE = 0.20

_EPS = 1e-9


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) \
        and math.isfinite(float(value))


def _median(values: list) -> float:
    ordered = sorted(values)
    n = len(ordered)
    mid = n // 2
    if n % 2:
        return float(ordered[mid])
    return float((ordered[mid - 1] + ordered[mid]) / 2.0)


def _mad(values: list, median: float) -> float:
    return _median([abs(v - median) for v in values])


def build_baseline(history: list) -> dict:
    """Строит личную норму по калибровочным сессиям.

    history — список acoustic_features САМЫХ РАННИХ сессий одного пользователя
    в одном режиме, в хронологическом порядке (старые → новые).
    """
    window = [h for h in (history or []) if isinstance(h, dict)][:BASELINE_WINDOW_SESSIONS]

    features = {}
    for feat in RISK_DIRECTION:
        values = [float(h[feat]) for h in window if _is_number(h.get(feat))]
        if len(values) < MIN_BASELINE_SESSIONS:
            continue

        median = _median(values)
        if median < MIN_PLAUSIBLE_MEDIAN.get(feat, -math.inf):
            # Вырожденное измерение, а не тихий голос — см. MIN_PLAUSIBLE_MEDIAN.
            continue

        floor = ABS_SCALE_FLOOR.get(feat, REL_SCALE_FLOOR * abs(median))
        scale = max(MAD_TO_SIGMA * _mad(values, median), floor)
        if scale < _EPS:
            # Признак константно нулевой: ни разброса, ни медианы — сравнивать
            # не с чем.
            continue

        features[feat] = {"median": median, "scale": scale, "n": len(values)}

    return {"n_sessions": len(window), "features": features}


def calculate_burnout_deltas(baseline: dict, current_features: dict) -> dict:
    """Относительное изменение каждого признака к личной медиане.

    Возвращает долю (0.15 = +15% к норме), а не абсолютные единицы — так
    величины разной природы (Гц, дБ, доли) можно показывать в одном списке.
    """
    deltas = {}
    for feat, stats in (baseline or {}).get("features", {}).items():
        current = current_features.get(feat)
        if not _is_number(current):
            continue
        median = stats["median"]
        if abs(median) < _EPS:
            continue
        deltas[feat] = float(current) / median - 1.0
    return deltas


def _monotony_warning(deltas: dict):
    """Тревожный маркер: голос одновременно стал монотоннее и нестабильнее."""
    pitch_change = deltas.get("pitch_std")
    jitter_change = deltas.get("jitter")
    if pitch_change is None or jitter_change is None:
        return False, None
    if pitch_change < MONOTONY_DROP and jitter_change > JITTER_RISE:
        return True, (
            f"Вариативность тона упала на {abs(pitch_change) * 100:.0f}% "
            f"относительно личной нормы при росте дрожания голоса на "
            f"{jitter_change * 100:.0f}%"
        )
    return False, None


def evaluate(baseline: dict, current_features: dict) -> dict:
    """Сравнивает текущую запись с личной нормой.

    deviation_score ∈ (-1, 1): положительное — хуже личной нормы, отрицательное
    — лучше. Это средний знаковый сдвиг в сигмах, сжатый через tanh, поэтому
    величина монотонна и границ не достигает — ряд остаётся различимым и после
    сильного ухудшения.

    Это НЕ вероятность выгорания и НЕ сопоставимо со шкалой score из model.py:
    там абсолютная оценка снимка, здесь относительное смещение человека к себе.
    """
    baseline = baseline or {}
    features = baseline.get("features", {})
    n_sessions = int(baseline.get("n_sessions", 0))

    if n_sessions < MIN_BASELINE_SESSIONS:
        return {
            "status": "calibrating",
            "n_baseline": n_sessions,
            "sessions_until_ready": max(0, MIN_BASELINE_SESSIONS - n_sessions),
            "deviation_score": None,
            "direction": None,
            "deltas": {},
            "z_scores": {},
            "is_warning": False,
            "warning_reason": None,
        }

    if len(features) < MIN_BASELINE_FEATURES:
        # Сессий набрано достаточно, но пригодных признаков нет — запись(и) в
        # калибровке вырожденные. Это НЕ «идёт калибровка»: ждать нечего, лишние
        # сессии сами по себе проблему не исправят.
        return {
            "status": "unavailable",
            "n_baseline": n_sessions,
            "sessions_until_ready": 0,
            "deviation_score": None,
            "direction": None,
            "deltas": {},
            "z_scores": {},
            "is_warning": False,
            "warning_reason": None,
        }

    z_scores = {}
    for feat, stats in features.items():
        current = current_features.get(feat)
        if not _is_number(current):
            continue
        signed = RISK_DIRECTION[feat] * (float(current) - stats["median"]) / stats["scale"]
        z_scores[feat] = max(-Z_CLIP, min(Z_CLIP, signed))

    if not z_scores:
        return {
            "status": "unavailable",
            "n_baseline": n_sessions,
            "sessions_until_ready": 0,
            "deviation_score": None,
            "direction": None,
            "deltas": {},
            "z_scores": {},
            "is_warning": False,
            "warning_reason": None,
        }

    mean_z = sum(z_scores.values()) / len(z_scores)
    deviation = math.tanh(mean_z / Z_SOFT)
    deltas = calculate_burnout_deltas(baseline, current_features)
    is_warning, warning_reason = _monotony_warning(deltas)

    if deviation > DEVIATION_NOTABLE:
        direction = "worse"
    elif deviation < -DEVIATION_NOTABLE:
        direction = "better"
    else:
        direction = "stable"

    return {
        "status": "active",
        "n_baseline": n_sessions,
        "sessions_until_ready": 0,
        "deviation_score": float(deviation),
        "direction": direction,
        "deltas": {k: round(v, 4) for k, v in deltas.items()},
        "z_scores": {k: round(v, 3) for k, v in z_scores.items()},
        "is_warning": is_warning,
        "warning_reason": warning_reason,
    }
