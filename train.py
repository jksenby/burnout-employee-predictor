import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.metrics import classification_report
from sklearn.preprocessing import StandardScaler
import joblib
import os

from model import (
    ALL_FEATURE_NAMES, HUBERT_FEATURE_NAMES, EMOTION_FEATURE_NAMES,
    ACOUSTIC_FEATURE_NAMES, TEXT_FEATURE_NAMES, MODEL_PATH
)

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

    if label == 0:
        pitch_mean = np.random.normal(200, 50)
        pitch_std = np.random.normal(55, 20)
        pitch_range = np.random.normal(150, 50)
        pitch_median = np.random.normal(195, 45)
        energy_mean = np.random.normal(0.06, 0.03)
        energy_std = np.random.normal(0.035, 0.018)
        energy_max = np.random.normal(0.20, 0.08)
        jitter = np.random.normal(0.015, 0.008)
        shimmer = np.random.normal(0.25, 0.12)
        hnr = np.random.normal(12, 5)
        speech_rate = np.random.normal(4.0, 1.2)
        pause_ratio = np.random.normal(0.20, 0.10)
    elif label == 1:
        pitch_mean = np.random.normal(180, 45)
        pitch_std = np.random.normal(40, 18)
        pitch_range = np.random.normal(110, 45)
        pitch_median = np.random.normal(175, 40)
        energy_mean = np.random.normal(0.05, 0.025)
        energy_std = np.random.normal(0.028, 0.015)
        energy_max = np.random.normal(0.16, 0.07)
        jitter = np.random.normal(0.022, 0.010)
        shimmer = np.random.normal(0.35, 0.15)
        hnr = np.random.normal(9, 4.5)
        speech_rate = np.random.normal(3.2, 1.0)
        pause_ratio = np.random.normal(0.30, 0.12)
    else:
        pitch_mean = np.random.normal(160, 40)
        pitch_std = np.random.normal(25, 12)
        pitch_range = np.random.normal(70, 35)
        pitch_median = np.random.normal(155, 38)
        energy_mean = np.random.normal(0.035, 0.020)
        energy_std = np.random.normal(0.018, 0.010)
        energy_max = np.random.normal(0.12, 0.06)
        jitter = np.random.normal(0.030, 0.012)
        shimmer = np.random.normal(0.50, 0.18)
        hnr = np.random.normal(6, 4)
        speech_rate = np.random.normal(2.5, 0.9)
        pause_ratio = np.random.normal(0.42, 0.13)

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
    n_a = len(ACOUSTIC_FEATURE_NAMES)
    n_t = len(TEXT_FEATURE_NAMES)

    stream_imp = {
        "HuBERT Acoustic": np.sum(importances[:n_h]),
        "Emotion (SER)": np.sum(importances[n_h:n_h + n_e]),
        "WavLM Prosody + Acoustic": np.sum(importances[n_h + n_e:n_h + n_e + n_a]),
        "Whisper Linguistic": np.sum(importances[n_h + n_e + n_a:]),
    }
    print("\n  Stream-Level Importance:")
    for stream, imp in stream_imp.items():
        pct = imp / sum(stream_imp.values()) * 100
        bar = "█" * int(pct / 2)
        print(f"    {stream:30s} — {pct:5.1f}% {bar}")

    print(f"\n[4/4] Saving model to {MODEL_PATH}...")
    joblib.dump(model, MODEL_PATH)
    print(f"  Model saved! ({os.path.getsize(MODEL_PATH) / 1024:.1f} KB)")

    print("\n" + "=" * 60)
    print("  Training complete! Model ready for inference.")
    print("=" * 60)

    return model


if __name__ == "__main__":
    train_model()
