"""Лингвистические маркеры выгорания (text_features.py)."""

import pytest

from text_features import extract_text_features


def test_empty_text_gives_zero_features():
    features = extract_text_features("   ")

    assert features["word_count"] == 0
    assert all(value == 0 for value in features.values())


def test_english_negative_text():
    features = extract_text_features(
        "I am always tired and exhausted, I never have energy, everything is awful"
    )

    assert features["sentiment_polarity"] < 0
    assert features["negative_word_ratio"] > 0
    assert features["absolutist_index"] > 0
    assert features["first_person_ratio"] > 0


def test_english_positive_text():
    features = extract_text_features("Work is great, I feel happy and motivated")

    assert features["sentiment_polarity"] > 0
    assert features["negative_word_ratio"] == 0


def test_russian_stems_catch_inflections():
    # «устала», «выгорела» — флективные формы, словарь хранит основы.
    features = extract_text_features("Я очень устала и выгорела, всё надоело")

    assert features["sentiment_polarity"] == pytest.approx(-1.0)
    assert features["negative_word_ratio"] > 0.3
    assert features["first_person_ratio"] > 0


def test_kazakh_positive_text():
    features = extract_text_features("Мен жұмысқа өте ризамын, бәрі жақсы")

    assert features["sentiment_polarity"] > 0


def test_hedging_phrases_counted():
    features = extract_text_features("Может быть, я не уверена, наверное всё нормально")

    assert features["hedging_ratio"] > 0


def test_feature_ranges():
    features = extract_text_features("Сегодня обычный день, ничего особенного")

    assert -1.0 <= features["sentiment_polarity"] <= 1.0
    assert 0.0 <= features["sentiment_subjectivity"] <= 1.0
    for key in ("absolutist_index", "first_person_ratio",
                "negative_word_ratio", "hedging_ratio"):
        assert 0.0 <= features[key] <= 1.0
