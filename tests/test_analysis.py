"""Личная норма голоса и отклонение от неё (analysis.py)."""

import pytest

import analysis


def _history(base, n, jitter=0.0):
    """n сессий около base; jitter — небольшой разброс между ними."""
    out = []
    for i in range(n):
        k = 1.0 + jitter * ((i % 3) - 1)
        out.append({key: value * k for key, value in base.items()})
    return out


def test_calibrating_until_min_sessions(stable_session):
    baseline = analysis.build_baseline(_history(stable_session, 2))
    result = analysis.evaluate(baseline, stable_session)

    assert result["status"] == "calibrating"
    assert result["sessions_until_ready"] == analysis.MIN_BASELINE_SESSIONS - 2
    assert result["deviation_score"] is None


def test_baseline_uses_only_first_window(stable_session):
    baseline = analysis.build_baseline(_history(stable_session, 8))

    assert baseline["n_sessions"] == analysis.BASELINE_WINDOW_SESSIONS
    assert set(baseline["features"]) == set(analysis.RISK_DIRECTION)


def test_same_recording_is_stable(stable_session):
    baseline = analysis.build_baseline(_history(stable_session, 5, jitter=0.05))
    result = analysis.evaluate(baseline, stable_session)

    assert result["status"] == "active"
    assert result["direction"] == "stable"
    assert abs(result["deviation_score"]) < analysis.DEVIATION_NOTABLE


def test_degraded_voice_is_worse(stable_session):
    baseline = analysis.build_baseline(_history(stable_session, 5, jitter=0.05))
    degraded = dict(stable_session)
    degraded.update(
        pitch_std=12.0,       # монотоннее
        speech_rate=2.8,      # медленнее
        pause_ratio=0.45,     # больше пауз
        jitter=0.025,         # нестабильнее
    )
    result = analysis.evaluate(baseline, degraded)

    assert result["direction"] == "worse"
    assert result["deviation_score"] > analysis.DEVIATION_NOTABLE
    assert result["is_warning"] is True
    assert "тона" in result["warning_reason"]


def test_improved_voice_is_better(stable_session):
    baseline = analysis.build_baseline(_history(stable_session, 5, jitter=0.05))
    improved = dict(stable_session)
    improved.update(pitch_std=40.0, speech_rate=5.2, pause_ratio=0.12, hnr=19.0)
    result = analysis.evaluate(baseline, improved)

    assert result["direction"] == "better"
    assert result["deviation_score"] < -analysis.DEVIATION_NOTABLE


def test_deviation_is_bounded(stable_session):
    baseline = analysis.build_baseline(_history(stable_session, 5))
    extreme = {key: value * 100 for key, value in stable_session.items()}
    score = analysis.evaluate(baseline, extreme)["deviation_score"]

    assert -1.0 < score < 1.0


def test_degenerate_recordings_make_baseline_unavailable(stable_session):
    # Praat вернул нули (ни одного периода F0) — такая норма бесполезна.
    broken = dict(stable_session, pitch_std=0.0, pitch_range=0.0,
                  speech_rate=0.0, jitter=0.0, shimmer=0.0)
    baseline = analysis.build_baseline(_history(broken, 5))
    result = analysis.evaluate(baseline, stable_session)

    assert result["status"] == "unavailable"


def test_scale_floor_prevents_tiny_mad_blowup(stable_session):
    # Пять идентичных сессий: MAD = 0, и без пола любое изменение дало бы z → ∞.
    baseline = analysis.build_baseline(_history(stable_session, 5))
    slightly_off = dict(stable_session, jitter=stable_session["jitter"] + 0.0004)
    result = analysis.evaluate(baseline, slightly_off)

    assert result["z_scores"]["jitter"] < 1.0


def test_non_numeric_values_are_ignored(stable_session):
    history = _history(stable_session, 5)
    history[0]["hnr"] = None
    history[1]["hnr"] = float("nan")
    history[2]["hnr"] = True  # bool не должен считаться числом
    baseline = analysis.build_baseline(history)

    assert "hnr" not in baseline["features"]


@pytest.mark.parametrize("current, expected", [(30.0, 0.2), (20.0, -0.2)])
def test_deltas_are_relative(stable_session, current, expected):
    baseline = analysis.build_baseline(_history(stable_session, 5))
    deltas = analysis.calculate_burnout_deltas(
        baseline, dict(stable_session, pitch_std=current)
    )

    assert deltas["pitch_std"] == pytest.approx(expected)
