import numpy as np
import json
import os
import joblib


HUBERT_FEATURE_NAMES = [
    "hubert_norm", "hubert_mean", "hubert_std", "hubert_skew",
    "hubert_kurtosis", "hubert_pos_ratio", "hubert_max_abs",
    "hubert_min", "hubert_max", "hubert_median"
]

EMOTION_FEATURE_NAMES = [
    "emo_angry", "emo_happy", "emo_sad", "emo_neutral"
]

WAVLM_FEATURE_NAMES = [
    "wavlm_norm", "wavlm_mean", "wavlm_std", "wavlm_skew",
    "wavlm_kurtosis", "wavlm_pos_ratio", "wavlm_max_abs",
    "wavlm_min", "wavlm_max", "wavlm_median"
]

ACOUSTIC_FEATURE_NAMES = [
    "pitch_mean", "pitch_std", "pitch_range", "pitch_median",
    "energy_mean", "energy_std", "energy_max",
    "jitter", "shimmer", "hnr",
    "speech_rate", "pause_ratio",
    "spectral_centroid_mean", "spectral_centroid_std",
] + [f"mfcc_{i}_mean" for i in range(13)] + [f"mfcc_{i}_std" for i in range(13)]

TEXT_FEATURE_NAMES = [
    "sentiment_polarity", "sentiment_subjectivity",
    "absolutist_index", "first_person_ratio",
    "negative_word_ratio", "hedging_ratio",
    "word_count", "avg_word_length"
]

# Нейтральные значения текстовых признаков — средние по трём классам
# синтетического генератора из train.py. Нужны для режима чтения, где
# транскрипт не снимается (main.py: include_transcript=False).
#
# Занулять эти признаки нельзя: модель обучалась на векторах, где они ВСЕГДА
# заполнены, и вектор с word_count=0 и avg_word_length=0 (против ~30–60 и ~4.0
# в обучении) оказывается за пределами обучающего распределения — предсказание
# на нём ничего не значит. Значения ниже означают «поток не даёт информации»,
# а не «в тексте нет негатива».
#
# train.py при обучении печатает эмпирические средние по этим признакам —
# если генератор меняется, числа ниже нужно обновить.
TEXT_FEATURE_DEFAULTS = {
    "sentiment_polarity": -0.0233,
    "sentiment_subjectivity": 0.51,
    "absolutist_index": 0.0283,
    "first_person_ratio": 0.08,
    "negative_word_ratio": 0.0183,
    "hedging_ratio": 0.035,
    "word_count": 45.0,
    "avg_word_length": 4.0,
}

ALL_FEATURE_NAMES = (
    HUBERT_FEATURE_NAMES + EMOTION_FEATURE_NAMES +
    WAVLM_FEATURE_NAMES + ACOUSTIC_FEATURE_NAMES + TEXT_FEATURE_NAMES
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "burnout_model.pkl")
MODEL_META_PATH = os.path.join(os.path.dirname(__file__), "burnout_model.meta.json")


def load_model_meta() -> dict:
    """Метаданные обученной модели (пишутся train.py). Пусто, если их нет."""
    if not os.path.exists(MODEL_META_PATH):
        return {}
    try:
        with open(MODEL_META_PATH, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as e:
        print(f"Warning: could not read model metadata ({e})")
        return {}


def check_feature_schema(current_version: int) -> bool:
    """Сверяет схему признаков, на которой обучалась модель, с текущей.

    Без этой проверки модель, обученную на прежних шкалах (shimmer ~0.25 против
    ~0.06, темп речи в музыкальных онсетах против слогов), нельзя отличить от
    актуальной: предсказания остаются формально валидными и молча превращаются
    в мусор.
    """
    meta = load_model_meta()
    trained = meta.get("feature_schema")

    if trained is None:
        print(
            "WARNING: burnout_model.pkl has no metadata — it was trained before "
            "feature-schema versioning. Predictions may not match the current "
            "feature scales. Run `python train.py` to retrain."
        )
        return False

    if trained != current_version:
        print(
            f"WARNING: model was trained on feature schema v{trained}, but "
            f"feature_extraction now produces v{current_version}. Absolute "
            "predictions are unreliable until you run `python train.py`."
        )
        return False

    print(f"Model feature schema v{trained} matches feature_extraction.")
    return True


class BurnoutMultimodalClassifier:

    def __init__(self):
        self.labels = ["Low Risk", "Medium Risk", "High Risk"]
        self.model = None
        self._load_trained_model()

    def _load_trained_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                print(f"Loaded trained burnout model from {MODEL_PATH}")
            except Exception as e:
                print(f"Warning: Could not load model ({e}), using heuristic fallback")
                self.model = None
        else:
            print("No trained model found. Run train.py first, or using heuristic fallback.")

    def _extract_hubert_stats(self, hubert_embedding: list) -> list:
        emb = np.array(hubert_embedding)
        return [
            float(np.linalg.norm(emb)),
            float(np.mean(emb)),
            float(np.std(emb)),
            float(np.mean(emb) / (np.std(emb) + 1e-10)),
            float(np.mean((emb - np.mean(emb))**4) /
                  (np.std(emb)**4 + 1e-10)),
            float(np.sum(emb > 0) / len(emb)),
            float(np.max(np.abs(emb))),
            float(np.min(emb)),
            float(np.max(emb)),
            float(np.median(emb)),
        ]

    def _extract_wavlm_stats(self, wavlm_embedding: list) -> list:
        emb = np.array(wavlm_embedding)
        return [
            float(np.linalg.norm(emb)),
            float(np.mean(emb)),
            float(np.std(emb)),
            float(np.mean(emb) / (np.std(emb) + 1e-10)),
            float(np.mean((emb - np.mean(emb))**4) /
                  (np.std(emb)**4 + 1e-10)),
            float(np.sum(emb > 0) / len(emb)),
            float(np.max(np.abs(emb))),
            float(np.min(emb)),
            float(np.max(emb)),
            float(np.median(emb)),
        ]

    def _build_feature_vector(
        self,
        hubert_embedding: list,
        wavlm_embedding: list,
        acoustic_features: dict,
        emotion_result: dict,
        text_features: dict
    ) -> np.ndarray:
        vec = []

        vec.extend(self._extract_hubert_stats(hubert_embedding))

        emotions = emotion_result.get("emotions", {})
        vec.append(emotions.get("angry", 0.0))
        vec.append(emotions.get("happy", 0.0))
        vec.append(emotions.get("sad", 0.0))
        vec.append(emotions.get("neutral", 0.0))

        vec.extend(self._extract_wavlm_stats(wavlm_embedding))

        acoustic_vec = []
        for name in ACOUSTIC_FEATURE_NAMES:
            acoustic_vec.append(float(acoustic_features.get(name, 0.0)))
        vec.extend(acoustic_vec)

        # См. TEXT_FEATURE_DEFAULTS: отсутствующий транскрипт (режим чтения)
        # заполняется нейтральными значениями, а не нулями.
        text_source = text_features or {}
        for name in TEXT_FEATURE_NAMES:
            value = text_source.get(name)
            if value is None:
                value = TEXT_FEATURE_DEFAULTS[name]
            vec.append(float(value))

        return np.array(vec, dtype=np.float32)

    def predict(
        self,
        hubert_embedding: list,
        wavlm_embedding: list,
        acoustic_features: dict,
        emotion_result: dict,
        text_features: dict
    ) -> dict:
        try:
            feature_vec = self._build_feature_vector(
                hubert_embedding, wavlm_embedding,
                acoustic_features, emotion_result, text_features
            )

            if self.model is not None:
                return self._predict_trained(feature_vec, emotion_result, text_features)
            else:
                return self._predict_heuristic(
                    hubert_embedding, wavlm_embedding,
                    acoustic_features, emotion_result, text_features
                )

        except Exception as e:
            print(f"Error in prediction: {e}")
            raise

    def _predict_trained(
        self, feature_vec: np.ndarray,
        emotion_result: dict, text_features: dict
    ) -> dict:
        feature_vec_2d = feature_vec.reshape(1, -1)

        feature_vec_2d = np.nan_to_num(feature_vec_2d, nan=0.0, posinf=1.0, neginf=-1.0)

        probabilities = self.model.predict_proba(feature_vec_2d)[0]
        predicted_class = self.model.predict(feature_vec_2d)[0]
        label = self.labels[predicted_class]

        importances = self.model.feature_importances_
        n_hubert = len(HUBERT_FEATURE_NAMES)
        n_emotion = len(EMOTION_FEATURE_NAMES)
        n_wavlm = len(WAVLM_FEATURE_NAMES)
        n_acoustic = len(ACOUSTIC_FEATURE_NAMES)

        # Feature layout: [HuBERT | Emotion | WavLM | Acoustic | Text].
        # The "wavlm_prosody" stream covers BOTH the WavLM embedding stats and
        # the librosa prosodic/acoustic features (Stream 2 = WavLM + Acoustic).
        i_emotion = n_hubert
        i_wavlm = i_emotion + n_emotion
        i_acoustic = i_wavlm + n_wavlm
        i_text = i_acoustic + n_acoustic

        stream_importance = {
            "hubert_acoustic": float(np.sum(importances[:i_emotion])),
            "emotion": float(np.sum(importances[i_emotion:i_wavlm])),
            "wavlm_prosody": float(np.sum(importances[i_wavlm:i_text])),
            "faster_whisper_linguistic": float(np.sum(importances[
                i_text:
            ])) if text_features else 0.0,
        }

        total_imp = sum(stream_importance.values()) + 1e-10
        stream_contribution = {
            k: round(v / total_imp * 100, 1)
            for k, v in stream_importance.items()
        }

        score = float(probabilities[1] * 0.5 + probabilities[2] * 1.0)

        result = {
            "label": label,
            "score": float(score),
            "confidence": float(np.max(probabilities)),
            "probabilities": {
                self.labels[i]: float(probabilities[i])
                for i in range(3)
            },
            "stream_contributions": stream_contribution,
            "emotions": emotion_result.get("emotions", {}),
            "dominant_emotion": emotion_result.get("dominant_emotion", "unknown"),
            "text_analysis": text_features,
            "model_type": "trained_gradient_boosting"
        }

        print(f"Prediction: {label} (score={score:.3f}, "
              f"confidence={np.max(probabilities):.3f})")
        return result

    def _predict_heuristic(
        self,
        hubert_embedding: list,
        wavlm_embedding: list,
        acoustic_features: dict,
        emotion_result: dict,
        text_features: dict
    ) -> dict:
        hubert_stats = self._extract_hubert_stats(hubert_embedding)
        hubert_std = hubert_stats[2]
        hubert_variability_risk = 1.0 - np.clip(hubert_std / 2.0, 0, 1)

        emotions = emotion_result.get("emotions", {})
        exhaustion = emotion_result.get("emotional_exhaustion_score", 0.5)

        wavlm_stats = self._extract_wavlm_stats(wavlm_embedding)
        wavlm_std = wavlm_stats[2]
        wavlm_variability_risk = 1.0 - np.clip(wavlm_std / 2.0, 0, 1)

        pitch_std = acoustic_features.get("pitch_std", 50.0)
        energy_mean = acoustic_features.get("energy_mean", 0.05)
        speech_rate = acoustic_features.get("speech_rate", 3.0)
        pause_ratio = acoustic_features.get("pause_ratio", 0.3)

        prosody_risk = np.clip(
            0.3 * (1.0 - np.clip(pitch_std / 100.0, 0, 1)) +
            0.2 * (1.0 - np.clip(energy_mean / 0.1, 0, 1)) +
            0.2 * np.clip(pause_ratio, 0, 1) +
            0.3 * (1.0 - np.clip(speech_rate / 6.0, 0, 1)),
            0, 1
        )

        # Веса задаются на доступные потоки и нормируются на их сумму. Без
        # транскрипта лингвистический член просто выпадает: подставлять в него
        # нули означало бы «речь идеально нейтральна», то есть добавлять к
        # оценке несуществующее свидетельство.
        components = [
            (0.25, hubert_variability_risk),
            (0.20, exhaustion),
            (0.25, prosody_risk),
            (0.15, wavlm_variability_risk),
        ]

        if text_features:
            sentiment = text_features.get("sentiment_polarity", 0.0)
            absolutist = text_features.get("absolutist_index", 0.0)
            negative_ratio = text_features.get("negative_word_ratio", 0.0)

            linguistic_risk = np.clip(
                0.4 * (1.0 - np.clip((sentiment + 1.0) / 2.0, 0, 1)) +
                0.3 * np.clip(absolutist * 10, 0, 1) +
                0.3 * np.clip(negative_ratio * 10, 0, 1),
                0, 1
            )
            components.append((0.15, linguistic_risk))

        total_weight = sum(w for w, _ in components)
        score = float(np.clip(
            sum(w * v for w, v in components) / total_weight,
            0.0, 1.0
        ))

        if score < 0.35:
            label = self.labels[0]
            probs = [0.70, 0.25, 0.05]
        elif score < 0.65:
            label = self.labels[1]
            mid = (score - 0.35) / 0.30
            probs = [0.20 - mid * 0.15, 0.60, 0.20 + mid * 0.15]
        else:
            label = self.labels[2]
            probs = [0.05, 0.25, 0.70]

        if text_features:
            stream_contribution = {
                "hubert_acoustic": 25.0,
                "emotion": 20.0,
                "wavlm_prosody": 40.0,
                "faster_whisper_linguistic": 15.0,
            }
        else:
            stream_contribution = {
                "hubert_acoustic": 29.4,
                "emotion": 23.5,
                "wavlm_prosody": 47.1,
                "faster_whisper_linguistic": 0.0,
            }

        result = {
            "label": label,
            "score": score,
            "confidence": float(max(probs)),
            "probabilities": {
                self.labels[i]: float(probs[i]) for i in range(3)
            },
            "stream_contributions": stream_contribution,
            "emotions": emotions,
            "dominant_emotion": emotion_result.get("dominant_emotion", "unknown"),
            "text_analysis": text_features,
            "model_type": "heuristic_fallback"
        }

        print(f"Heuristic prediction: {label} (score={score:.3f})")
        return result


_classifier = None


def getClassifier():
    global _classifier
    if _classifier is None:
        _classifier = BurnoutMultimodalClassifier()
    return _classifier


def predict(
    hubert_embedding: list,
    wavlm_embedding: list,
    acoustic_features: dict,
    emotion_result: dict,
    text_features: dict
) -> dict:
    classifier = getClassifier()
    return classifier.predict(
        hubert_embedding, wavlm_embedding,
        acoustic_features, emotion_result, text_features
    )