"""Классификатор риска выгорания (model.py)."""

import json

import numpy as np
import pytest

import model
from feature_extraction import FEATURE_SCHEMA_VERSION


def _inputs(rng, *, stressed=False):
    emb_scale = 0.3 if stressed else 1.5
    acoustic = {name: 0.0 for name in model.ACOUSTIC_FEATURE_NAMES}
    acoustic.update(
        pitch_std=8.0 if stressed else 60.0,
        energy_mean=0.01 if stressed else 0.09,
        speech_rate=2.0 if stressed else 5.5,
        pause_ratio=0.6 if stressed else 0.1,
    )
    if stressed:
        emotions = {"angry": 0.1, "happy": 0.1, "sad": 0.7, "neutral": 0.1}
    else:
        emotions = {"angry": 0.0, "happy": 0.8, "sad": 0.0, "neutral": 0.2}
    emotion = {
        "emotions": emotions,
        "dominant_emotion": max(emotions, key=emotions.get),
        "emotional_exhaustion_score": 0.9 if stressed else 0.1,
    }
    text = {
        "sentiment_polarity": -0.8 if stressed else 0.6,
        "absolutist_index": 0.1 if stressed else 0.0,
        "negative_word_ratio": 0.2 if stressed else 0.0,
    }
    return dict(
        hubert_embedding=rng.normal(0, emb_scale, 768).tolist(),
        wavlm_embedding=rng.normal(0, emb_scale, 768).tolist(),
        acoustic_features=acoustic,
        emotion_result=emotion,
        text_features=text,
    )


@pytest.fixture
def heuristic(monkeypatch):
    monkeypatch.setattr(model.BurnoutMultimodalClassifier, "_load_trained_model",
                        lambda self: None)
    return model.BurnoutMultimodalClassifier()


@pytest.fixture
def trained():
    clf = model.BurnoutMultimodalClassifier()
    if clf.model is None:
        pytest.skip("burnout_model.pkl недоступен")
    return clf


def test_feature_layout_matches_metadata():
    meta = model.load_model_meta()

    assert meta["n_features"] == len(model.ALL_FEATURE_NAMES)
    assert meta["feature_names"] == model.ALL_FEATURE_NAMES
    assert meta["labels"] == ["Low Risk", "Medium Risk", "High Risk"]


def test_model_schema_matches_feature_extraction():
    assert model.check_feature_schema(FEATURE_SCHEMA_VERSION) is True
    assert model.check_feature_schema(FEATURE_SCHEMA_VERSION + 1) is False


def test_feature_vector_length(heuristic):
    vec = heuristic._build_feature_vector(**_inputs(np.random.default_rng(0)))

    assert vec.shape == (len(model.ALL_FEATURE_NAMES),)
    assert np.all(np.isfinite(vec))


def test_missing_transcript_uses_neutral_defaults(heuristic):
    args = _inputs(np.random.default_rng(0))
    args["text_features"] = {}
    vec = heuristic._build_feature_vector(**args)
    text_part = vec[-len(model.TEXT_FEATURE_NAMES):]
    expected = [model.TEXT_FEATURE_DEFAULTS[n] for n in model.TEXT_FEATURE_NAMES]

    assert text_part == pytest.approx(expected, rel=1e-5)


def test_heuristic_orders_risk(heuristic):
    rng = np.random.default_rng(1)
    calm = heuristic.predict(**_inputs(rng))
    stressed = heuristic.predict(**_inputs(rng, stressed=True))

    assert calm["model_type"] == "heuristic_fallback"
    assert stressed["score"] > calm["score"]
    assert stressed["label"] == "High Risk"
    assert calm["label"] == "Low Risk"


def test_heuristic_without_transcript_drops_linguistic_stream(heuristic):
    args = _inputs(np.random.default_rng(2))
    args["text_features"] = {}
    result = heuristic.predict(**args)

    assert result["stream_contributions"]["faster_whisper_linguistic"] == 0.0
    assert sum(result["stream_contributions"].values()) == pytest.approx(100.0, abs=0.1)


def test_trained_model_output_contract(trained):
    result = trained.predict(**_inputs(np.random.default_rng(3)))

    assert result["model_type"] == "trained_gradient_boosting"
    assert result["label"] in trained.labels
    assert sum(result["probabilities"].values()) == pytest.approx(1.0)
    assert 0.0 <= result["score"] <= 1.0
    assert sum(result["stream_contributions"].values()) == pytest.approx(100.0, abs=0.5)


def test_metadata_absent_is_reported(tmp_path, monkeypatch):
    monkeypatch.setattr(model, "MODEL_META_PATH", str(tmp_path / "missing.json"))

    assert model.load_model_meta() == {}
    assert model.check_feature_schema(FEATURE_SCHEMA_VERSION) is False


def test_corrupt_metadata_is_tolerated(tmp_path, monkeypatch):
    bad = tmp_path / "meta.json"
    bad.write_text("{not json", encoding="utf-8")
    monkeypatch.setattr(model, "MODEL_META_PATH", str(bad))

    assert model.load_model_meta() == {}


def test_metadata_file_is_valid_json():
    with open(model.MODEL_META_PATH, encoding="utf-8") as fh:
        assert json.load(fh)["feature_schema"] == FEATURE_SCHEMA_VERSION
