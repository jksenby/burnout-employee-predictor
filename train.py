import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.metrics import classification_report
import joblib
import json
import os

from model import (
    ALL_FEATURE_NAMES, HUBERT_FEATURE_NAMES, EMOTION_FEATURE_NAMES,
    WAVLM_FEATURE_NAMES, ACOUSTIC_FEATURE_NAMES, TEXT_FEATURE_NAMES,
    TEXT_FEATURE_DEFAULTS, MODEL_PATH, MODEL_META_PATH
)
from feature_extraction import FEATURE_SCHEMA_VERSION

np.random.seed(42)


def generate_synthetic_sample(label: int) -> np.ndarray:
    features = []

    if label == 0:
        hubert_norm = np.random.normal(5.5, 0.8)
        hubert_mean = np.random.normal(0.005, 0.01)
        hubert_std = np.random.normal(0.20, 0.04)
        hubert_skew = np.random.normal(0.0, 0.3)
        hubert_kurt = np.random.normal(3.0, 0.5)
        hubert_pos = np.random.normal(0.52, 0.04)
        hubert_maxabs = np.random.normal(1.0, 0.25)
        hubert_min = np.random.normal(-1.0, 0.25)
        hubert_max = np.random.normal(1.0, 0.25)
        hubert_median = np.random.normal(0.0, 0.02)
    elif label == 1:
        hubert_norm = np.random.normal(5.0, 0.7)
        hubert_mean = np.random.normal(0.008, 0.012)
        hubert_std = np.random.normal(0.18, 0.04)
        hubert_skew = np.random.normal(0.15, 0.35)
        hubert_kurt = np.random.normal(3.3, 0.6)
        hubert_pos = np.random.normal(0.51, 0.04)
        hubert_maxabs = np.random.normal(0.9, 0.22)
        hubert_min = np.random.normal(-0.9, 0.22)
        hubert_max = np.random.normal(0.9, 0.22)
        hubert_median = np.random.normal(0.005, 0.025)
    else:
        hubert_norm = np.random.normal(4.5, 0.7)
        hubert_mean = np.random.normal(0.012, 0.015)
        hubert_std = np.random.normal(0.15, 0.04)
        hubert_skew = np.random.normal(0.3, 0.4)
        hubert_kurt = np.random.normal(3.6, 0.8)
        hubert_pos = np.random.normal(0.50, 0.05)
        hubert_maxabs = np.random.normal(0.75, 0.20)
        hubert_min = np.random.normal(-0.75, 0.20)
        hubert_max = np.random.normal(0.75, 0.20)
        hubert_median = np.random.normal(0.01, 0.03)

    features.extend([
        hubert_norm, hubert_mean, hubert_std, hubert_skew,
        hubert_kurt, hubert_pos, hubert_maxabs, hubert_min,
        hubert_max, hubert_median
    ])

    if label == 0:
        emo_angry = np.random.uniform(0.01, 0.40)
        emo_happy = np.random.uniform(0.15, 0.60)
        emo_sad = np.random.uniform(0.01, 0.20)
        emo_neutral = np.random.uniform(0.10, 0.55)
    elif label == 1:
        emo_angry = np.random.uniform(0.05, 0.45)
        emo_happy = np.random.uniform(0.05, 0.40)
        emo_sad = np.random.uniform(0.05, 0.40)
        emo_neutral = np.random.uniform(0.10, 0.50)
    else:
        emo_angry = np.random.uniform(0.02, 0.50)
        emo_happy = np.random.uniform(0.01, 0.20)
        emo_sad = np.random.uniform(0.15, 0.60)
        emo_neutral = np.random.uniform(0.10, 0.50)

    emo_total = emo_angry + emo_happy + emo_sad + emo_neutral + 1e-10
    features.extend([
        emo_angry / emo_total,
        emo_happy / emo_total,
        emo_sad / emo_total,
        emo_neutral / emo_total
    ])

    # WavLM prosody embedding summary stats (Stream 2). Like HuBERT, healthier
    # speech tends to carry a slightly higher-variance, fuller embedding.
    if label == 0:
        wavlm_norm = np.random.normal(5.3, 0.8)
        wavlm_mean = np.random.normal(0.004, 0.01)
        wavlm_std = np.random.normal(0.19, 0.04)
        wavlm_skew = np.random.normal(0.0, 0.3)
        wavlm_kurt = np.random.normal(3.0, 0.5)
        wavlm_pos = np.random.normal(0.52, 0.04)
        wavlm_maxabs = np.random.normal(0.95, 0.24)
        wavlm_min = np.random.normal(-0.95, 0.24)
        wavlm_max = np.random.normal(0.95, 0.24)
        wavlm_median = np.random.normal(0.0, 0.02)
    elif label == 1:
        wavlm_norm = np.random.normal(4.8, 0.7)
        wavlm_mean = np.random.normal(0.007, 0.012)
        wavlm_std = np.random.normal(0.17, 0.04)
        wavlm_skew = np.random.normal(0.15, 0.35)
        wavlm_kurt = np.random.normal(3.3, 0.6)
        wavlm_pos = np.random.normal(0.51, 0.04)
        wavlm_maxabs = np.random.normal(0.85, 0.22)
        wavlm_min = np.random.normal(-0.85, 0.22)
        wavlm_max = np.random.normal(0.85, 0.22)
        wavlm_median = np.random.normal(0.005, 0.025)
    else:
        wavlm_norm = np.random.normal(4.3, 0.7)
        wavlm_mean = np.random.normal(0.011, 0.015)
        wavlm_std = np.random.normal(0.14, 0.04)
        wavlm_skew = np.random.normal(0.3, 0.4)
        wavlm_kurt = np.random.normal(3.6, 0.8)
        wavlm_pos = np.random.normal(0.50, 0.05)
        wavlm_maxabs = np.random.normal(0.70, 0.20)
        wavlm_min = np.random.normal(-0.70, 0.20)
        wavlm_max = np.random.normal(0.70, 0.20)
        wavlm_median = np.random.normal(0.01, 0.03)

    features.extend([
        wavlm_norm, wavlm_mean, wavlm_std, wavlm_skew,
        wavlm_kurt, wavlm_pos, wavlm_maxabs, wavlm_min,
        wavlm_max, wavlm_median
    ])

    # Шкалы соответствуют feature_extraction schema v2 (Praat):
    #   jitter  — local jitter, доля (норма связной речи ≈1–2%)
    #   shimmer — local shimmer, доля (≈5–12%)
    #   hnr     — Harmonicity (cc), дБ (связная речь ≈10–18)
    #   speech_rate — слоговые ядра в секунду (≈4–6 в норме)
    # Это литературные априорные диапазоны для генератора, а НЕ измерения на
    # реальной выборке: модель обучается на синтетике, и её точность на
    # кросс-валидации отражает разделимость заданных здесь распределений.
    #
    # pitch_mean и pitch_median намеренно НЕ зависят от класса. В прежней
    # версии «высокий риск» задавался в том числе более низким абсолютным
    # тоном (160 Гц против 200 Гц), из-за чего мужчина с низким голосом
    # получал High Risk всегда, а женщина с высоким — Low Risk всегда.
    # Абсолютная высота — признак говорящего, а не состояния; маркером
    # уплощения просодии служат ВАРИАТИВНОСТЬ (pitch_std) и диапазон.
    pitch_mean = np.random.normal(165, 50)
    pitch_median = pitch_mean + np.random.normal(0, 8)

    if label == 0:
        pitch_std = np.random.normal(42, 12)
        pitch_range = np.random.normal(175, 45)
        energy_mean = np.random.normal(0.06, 0.03)
        energy_std = np.random.normal(0.035, 0.018)
        energy_max = np.random.normal(0.20, 0.08)
        jitter = np.random.normal(0.010, 0.005)
        shimmer = np.random.normal(0.055, 0.022)
        hnr = np.random.normal(16.0, 4.0)
        speech_rate = np.random.normal(4.6, 0.9)
        pause_ratio = np.random.normal(0.22, 0.10)
    elif label == 1:
        pitch_std = np.random.normal(31, 10)
        pitch_range = np.random.normal(130, 40)
        energy_mean = np.random.normal(0.05, 0.025)
        energy_std = np.random.normal(0.028, 0.015)
        energy_max = np.random.normal(0.16, 0.07)
        jitter = np.random.normal(0.016, 0.006)
        shimmer = np.random.normal(0.078, 0.026)
        hnr = np.random.normal(12.5, 4.0)
        speech_rate = np.random.normal(3.9, 0.9)
        pause_ratio = np.random.normal(0.32, 0.12)
    else:
        pitch_std = np.random.normal(21, 8)
        pitch_range = np.random.normal(90, 35)
        energy_mean = np.random.normal(0.035, 0.020)
        energy_std = np.random.normal(0.018, 0.010)
        energy_max = np.random.normal(0.12, 0.06)
        jitter = np.random.normal(0.024, 0.008)
        shimmer = np.random.normal(0.105, 0.032)
        hnr = np.random.normal(9.0, 4.0)
        speech_rate = np.random.normal(3.1, 0.9)
        pause_ratio = np.random.normal(0.44, 0.13)

    spectral_centroid_mean = np.random.normal(1800, 600)
    spectral_centroid_std = np.random.normal(700, 250)

    features.extend([
        abs(pitch_mean), abs(pitch_std), abs(pitch_range), abs(pitch_median),
        abs(energy_mean), abs(energy_std), abs(energy_max),
        abs(jitter), abs(shimmer), hnr,
        abs(speech_rate), np.clip(pause_ratio, 0, 1),
        abs(spectral_centroid_mean), abs(spectral_centroid_std)
    ])

    for i in range(13):
        if i == 0:
            base = np.random.normal(-300, 80)
        else:
            base = np.random.normal(0, 30)
        if label == 0:
            features.append(base + np.random.normal(10, 5))
        elif label == 1:
            features.append(base + np.random.normal(0, 5))
        else:
            features.append(base + np.random.normal(-10, 5))

    for i in range(13):
        features.append(abs(np.random.normal(30 + i * 3, 12)))

    if label == 0:
        sentiment_polarity = np.random.normal(0.10, 0.18)
        sentiment_subjectivity = np.random.normal(0.45, 0.18)
        absolutist_index = np.random.exponential(0.01)
        first_person_ratio = np.random.normal(0.05, 0.03)
        negative_word_ratio = np.random.exponential(0.005)
        hedging_ratio = np.random.normal(0.02, 0.012)
        word_count = np.random.normal(60, 25)
        avg_word_length = np.random.normal(4.2, 0.6)
    elif label == 1:
        sentiment_polarity = np.random.normal(-0.02, 0.18)
        sentiment_subjectivity = np.random.normal(0.50, 0.18)
        absolutist_index = np.random.exponential(0.025)
        first_person_ratio = np.random.normal(0.08, 0.035)
        negative_word_ratio = np.random.exponential(0.015)
        hedging_ratio = np.random.normal(0.035, 0.015)
        word_count = np.random.normal(45, 22)
        avg_word_length = np.random.normal(4.0, 0.6)
    else:
        sentiment_polarity = np.random.normal(-0.15, 0.18)
        sentiment_subjectivity = np.random.normal(0.58, 0.18)
        absolutist_index = np.random.exponential(0.05)
        first_person_ratio = np.random.normal(0.11, 0.04)
        negative_word_ratio = np.random.exponential(0.035)
        hedging_ratio = np.random.normal(0.05, 0.02)
        word_count = np.random.normal(30, 18)
        avg_word_length = np.random.normal(3.8, 0.6)

    features.extend([
        np.clip(sentiment_polarity, -1, 1),
        np.clip(sentiment_subjectivity, 0, 1),
        np.clip(absolutist_index, 0, 1),
        np.clip(first_person_ratio, 0, 1),
        np.clip(negative_word_ratio, 0, 1),
        np.clip(hedging_ratio, 0, 1),
        max(word_count, 1),
        max(avg_word_length, 1),
    ])

    return np.array(features, dtype=np.float32)


def generate_dataset(n_samples: int = 1000) -> tuple:
    X = []
    y = []

    samples_per_class = n_samples // 3

    for label in [0, 1, 2]:
        for _ in range(samples_per_class):
            X.append(generate_synthetic_sample(label))
            y.append(label)

    X = np.array(X)
    y = np.array(y)

    indices = np.random.permutation(len(X))
    X = X[indices]
    y = y[indices]

    return X, y


def train_model():
    print("=" * 60)
    print("  Multimodal Burnout Prediction — Training Pipeline")
    print("=" * 60)

    print("\n[1/4] Generating synthetic dataset (N=1500)...")
    X, y = generate_dataset(n_samples=1500)
    print(f"  Dataset shape: X={X.shape}, y={y.shape}")
    print(f"  Class distribution: {np.bincount(y)}")
    print(f"  Feature count: {X.shape[1]} (expected {len(ALL_FEATURE_NAMES)})")

    X = np.nan_to_num(X, nan=0.0, posinf=1.0, neginf=-1.0)

    # Сверка TEXT_FEATURE_DEFAULTS с фактическим генератором. Эти значения
    # подставляются в вектор в режиме чтения, где транскрипта нет, поэтому они
    # должны совпадать со средними по обучающей выборке — иначе вектор чтения
    # уедет за пределы обучающего распределения.
    i_text = len(ALL_FEATURE_NAMES) - len(TEXT_FEATURE_NAMES)
    print("\n  Text-feature means (must match TEXT_FEATURE_DEFAULTS in model.py):")
    for offset, name in enumerate(TEXT_FEATURE_NAMES):
        empirical = float(X[:, i_text + offset].mean())
        declared = TEXT_FEATURE_DEFAULTS.get(name)
        drifted = declared is None or \
            abs(empirical - declared) > max(0.02 * abs(empirical), 0.01)
        flag = "   <-- UPDATE model.py" if drifted else ""
        print(f"    {name:26s} = {empirical:9.4f}  (declared: {declared}){flag}")

    print("\n[2/4] Training GradientBoostingClassifier...")
    model = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.8,
        min_samples_split=15,
        min_samples_leaf=8,
        random_state=42,
    )

    print("\n[3/4] Running 5-fold cross-validation...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, X, y, cv=cv, scoring="accuracy")
    print(f"  CV Accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")
    print(f"  Per-fold: {[f'{s:.4f}' for s in cv_scores]}")
    print("  NOTE: train and test folds both come from generate_synthetic_sample(),")
    print("        so this number measures how separable the hand-authored")
    print("        distributions above are — NOT predictive validity on real")
    print("        speech. It must not be reported as model accuracy.")

    model.fit(X, y)

    y_pred = model.predict(X)
    labels = ["Low Risk", "Medium Risk", "High Risk"]
    print("\n  Classification Report (training set):")
    print(classification_report(y, y_pred, target_names=labels))

    print("  Top 15 Most Important Features:")
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]
    for i, idx in enumerate(indices[:15]):
        name = ALL_FEATURE_NAMES[idx] if idx < len(ALL_FEATURE_NAMES) else f"feature_{idx}"
        print(f"    {i+1:2d}. {name:30s} — {importances[idx]:.4f}")

    n_h = len(HUBERT_FEATURE_NAMES)
    n_e = len(EMOTION_FEATURE_NAMES)
    n_w = len(WAVLM_FEATURE_NAMES)
    n_a = len(ACOUSTIC_FEATURE_NAMES)

    # Feature layout: [HuBERT | Emotion | WavLM | Acoustic | Text]
    i_e = n_h
    i_w = i_e + n_e
    i_a = i_w + n_w
    i_t = i_a + n_a

    stream_imp = {
        "HuBERT Acoustic": np.sum(importances[:i_e]),
        "Emotion (SER)": np.sum(importances[i_e:i_w]),
        "WavLM Prosody + Acoustic": np.sum(importances[i_w:i_t]),
        "Faster-Whisper Linguistic": np.sum(importances[i_t:]),
    }
    print("\n  Stream-Level Importance:")
    for stream, imp in stream_imp.items():
        pct = imp / sum(stream_imp.values()) * 100
        bar = "#" * int(pct / 2)
        print(f"    {stream:30s} — {pct:5.1f}% {bar}")

    print(f"\n[4/4] Saving model to {MODEL_PATH}...")
    joblib.dump(model, MODEL_PATH)
    print(f"  Model saved! ({os.path.getsize(MODEL_PATH) / 1024:.1f} KB)")

    # Сайдкар с версией схемы признаков. Без него модель, обученную на прежних
    # шкалах (shimmer ~0.25 вместо ~0.06, темп речи в онсетах вместо слогов),
    # нельзя отличить от актуальной, и предсказания молча становятся мусором.
    meta = {
        "feature_schema": FEATURE_SCHEMA_VERSION,
        "n_features": int(X.shape[1]),
        "feature_names": ALL_FEATURE_NAMES,
        "labels": labels,
        "training_data": "synthetic (generate_synthetic_sample)",
        "cv_accuracy_on_synthetic": float(cv_scores.mean()),
    }
    with open(MODEL_META_PATH, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
    print(f"  Metadata saved to {MODEL_META_PATH} (feature schema v{FEATURE_SCHEMA_VERSION})")

    print("\n" + "=" * 60)
    print("  Training complete! Model ready for inference.")
    print("=" * 60)

    return model


if __name__ == "__main__":
    train_model()
