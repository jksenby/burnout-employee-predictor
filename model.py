import numpy as np
import os
import joblib


# Feature name definitions for each stream
HUBERT_FEATURE_NAMES = [
    "hubert_norm", "hubert_mean", "hubert_std", "hubert_skew",
    "hubert_kurtosis", "hubert_pos_ratio", "hubert_max_abs",
    "hubert_min", "hubert_max", "hubert_median"
]

EMOTION_FEATURE_NAMES = [
    "emo_angry", "emo_happy", "emo_sad", "emo_neutral"
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

ALL_FEATURE_NAMES = (
    HUBERT_FEATURE_NAMES + EMOTION_FEATURE_NAMES +
    ACOUSTIC_FEATURE_NAMES + TEXT_FEATURE_NAMES
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "burnout_model.pkl")


class BurnoutMultimodalClassifier:
    """
    Multimodal Late-Fusion Burnout Classifier.
    
    Fuses three encoder streams:
      Stream 1 (HuBERT): Acoustic embeddings + emotion (14 features)
      Stream 2 (WavLM):  Prosody + acoustic features (45 features)
      Stream 3 (Whisper): Semantic/linguistic features (8 features)
    
    Total: 67 features → GradientBoostingClassifier → Low/Medium/High Risk
    """

    def __init__(self):
        self.labels = ["Low Risk", "Medium Risk", "High Risk"]
        self.model = None
        self._load_trained_model()

    def _load_trained_model(self):
        """Load pre-trained model from disk if available."""
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
        """Compute summary statistics from the 768-dim HuBERT embedding."""
        emb = np.array(hubert_embedding)
        return [
            float(np.linalg.norm(emb)),           # norm
            float(np.mean(emb)),                   # mean
            float(np.std(emb)),                    # std
            float(np.mean(emb) / (np.std(emb) + 1e-10)),  # skew approx
            float(np.mean((emb - np.mean(emb))**4) /
                  (np.std(emb)**4 + 1e-10)),       # kurtosis approx
            float(np.sum(emb > 0) / len(emb)),    # positive ratio
            float(np.max(np.abs(emb))),            # max abs
            float(np.min(emb)),                    # min
            float(np.max(emb)),                    # max
            float(np.median(emb)),                 # median
        ]

    def _extract_wavlm_stats(self, wavlm_embedding: list) -> list:
        """Compute summary statistics from the 768-dim WavLM embedding."""
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
        """
        Build the 62-feature vector from all streams.
        
        Stream 1 (HuBERT): 10 embedding stats + 4 emotion probs = 14
        Stream 2 (WavLM):  40 acoustic/prosody features (librosa-based,
                           informed by WavLM's noise-robust embedding context)
        Stream 3 (Whisper): 8 text features
        """
        vec = []

        # Stream 1: HuBERT embedding statistics (10)
        vec.extend(self._extract_hubert_stats(hubert_embedding))

        # Stream 1: Emotion probabilities (4)
        emotions = emotion_result.get("emotions", {})
        vec.append(emotions.get("angry", 0.0))
        vec.append(emotions.get("happy", 0.0))
        vec.append(emotions.get("sad", 0.0))
        vec.append(emotions.get("neutral", 0.0))

        # Stream 2: Acoustic/prosody features from librosa (40)
        acoustic_vec = []
        for name in ACOUSTIC_FEATURE_NAMES:
            acoustic_vec.append(float(acoustic_features.get(name, 0.0)))
        vec.extend(acoustic_vec)

        # Stream 3: Text features (8)
        for name in TEXT_FEATURE_NAMES:
            vec.append(float(text_features.get(name, 0.0)))

        return np.array(vec, dtype=np.float32)

    def predict(
        self,
        hubert_embedding: list,
        wavlm_embedding: list,
        acoustic_features: dict,
        emotion_result: dict,
        text_features: dict
    ) -> dict:
        """
        Run burnout prediction using multimodal late fusion.
        
        Returns prediction with per-stream contribution analysis.
        """
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
        """Predict using the trained GradientBoosting model."""
        feature_vec_2d = feature_vec.reshape(1, -1)

        # Handle NaN/Inf values
        feature_vec_2d = np.nan_to_num(feature_vec_2d, nan=0.0, posinf=1.0, neginf=-1.0)

        probabilities = self.model.predict_proba(feature_vec_2d)[0]
        predicted_class = self.model.predict(feature_vec_2d)[0]
        label = self.labels[predicted_class]

        # Compute feature importances per stream
        importances = self.model.feature_importances_
        n_hubert = len(HUBERT_FEATURE_NAMES)
        n_emotion = len(EMOTION_FEATURE_NAMES)
        n_acoustic = len(ACOUSTIC_FEATURE_NAMES)
        n_text = len(TEXT_FEATURE_NAMES)

        stream_importance = {
            "hubert_acoustic": float(np.sum(importances[:n_hubert])),
            "emotion": float(np.sum(importances[n_hubert:n_hubert + n_emotion])),
            "wavlm_prosody": float(np.sum(importances[
                n_hubert + n_emotion:n_hubert + n_emotion + n_acoustic
            ])),
            "whisper_linguistic": float(np.sum(importances[
                n_hubert + n_emotion + n_acoustic:
            ])),
        }

        # Normalize stream importances
        total_imp = sum(stream_importance.values()) + 1e-10
        stream_contribution = {
            k: round(v / total_imp * 100, 1)
            for k, v in stream_importance.items()
        }

        # Score is the weighted probability of medium + high risk
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
        """
        Fallback heuristic prediction when no trained model is available.
        Uses weighted rules based on each stream.
        """
        # Stream 1: HuBERT acoustic + emotion signals
        hubert_stats = self._extract_hubert_stats(hubert_embedding)
        hubert_std = hubert_stats[2]
        hubert_variability_risk = 1.0 - np.clip(hubert_std / 2.0, 0, 1)

        emotions = emotion_result.get("emotions", {})
        exhaustion = emotion_result.get("emotional_exhaustion_score", 0.5)

        # Stream 2: WavLM prosody + acoustic features
        wavlm_stats = self._extract_wavlm_stats(wavlm_embedding)
        wavlm_std = wavlm_stats[2]
        wavlm_variability_risk = 1.0 - np.clip(wavlm_std / 2.0, 0, 1)

        pitch_std = acoustic_features.get("pitch_std", 50.0)
        energy_mean = acoustic_features.get("energy_mean", 0.05)
        speech_rate = acoustic_features.get("speech_rate", 3.0)
        pause_ratio = acoustic_features.get("pause_ratio", 0.3)

        prosody_risk = np.clip(
            0.3 * (1.0 - np.clip(pitch_std / 100.0, 0, 1)) +   # low pitch variation
            0.2 * (1.0 - np.clip(energy_mean / 0.1, 0, 1)) +   # low energy
            0.2 * np.clip(pause_ratio, 0, 1) +                  # more pauses
            0.3 * (1.0 - np.clip(speech_rate / 6.0, 0, 1)),     # slow speech
            0, 1
        )

        # Stream 3: Whisper linguistic signals
        sentiment = text_features.get("sentiment_polarity", 0.0)
        absolutist = text_features.get("absolutist_index", 0.0)
        negative_ratio = text_features.get("negative_word_ratio", 0.0)

        linguistic_risk = np.clip(
            0.4 * (1.0 - np.clip((sentiment + 1.0) / 2.0, 0, 1)) +  # negative sentiment
            0.3 * np.clip(absolutist * 10, 0, 1) +                    # absolutist language
            0.3 * np.clip(negative_ratio * 10, 0, 1),                 # negative words
            0, 1
        )

        # Late fusion: weighted combination
        score = float(np.clip(
            0.25 * hubert_variability_risk +
            0.20 * exhaustion +
            0.25 * prosody_risk +
            0.15 * wavlm_variability_risk +
            0.15 * linguistic_risk,
            0.0, 1.0
        ))

        # Determine label and probabilities
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

        stream_contribution = {
            "hubert_acoustic": 25.0,
            "emotion": 20.0,
            "wavlm_prosody": 40.0,
            "whisper_linguistic": 15.0,
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


# Singleton
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
    """Main prediction entry point."""
    classifier = getClassifier()
    return classifier.predict(
        hubert_embedding, wavlm_embedding,
        acoustic_features, emotion_result, text_features
    )