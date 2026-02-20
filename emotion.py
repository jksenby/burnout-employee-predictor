import torch
import io
import numpy as np
import soundfile as sf
import torchaudio
from transformers import pipeline

_classifier = None


def _load_model():
    global _classifier

    if _classifier is None:
        print("Loading emotion recognition model...")
        device = 0 if torch.cuda.is_available() else -1

        # superb/wav2vec2-base-superb-er: wav2vec2 fine-tuned on IEMOCAP
        # Outputs: ang (angry), hap (happy), sad, neu (neutral)
        _classifier = pipeline(
            "audio-classification",
            model="superb/wav2vec2-base-superb-er",
            device=device,
        )
        print("Emotion model loaded")

    return _classifier


def extract_emotion(audio_bytes: bytes) -> dict:
    """
    Speech Emotion Recognition using wav2vec2 fine-tuned on IEMOCAP
    via the Hugging Face audio-classification pipeline.
    
    Returns emotion probabilities and burnout-relevant indicators.
    """
    try:
        classifier = _load_model()

        audio_buffer = io.BytesIO(audio_bytes)
        y, sr = sf.read(audio_buffer, dtype="float32")

        # Convert stereo to mono
        if len(y.shape) > 1:
            y = y.mean(axis=1)

        # Resample to 16kHz
        if sr != 16000:
            y_tensor = torch.tensor(y).unsqueeze(0)
            resampler = torchaudio.transforms.Resample(sr, 16000)
            y = resampler(y_tensor).squeeze(0).numpy()

        # Run classification — pipeline expects dict with array + sampling_rate
        results = classifier({"array": y, "sampling_rate": 16000}, top_k=None)

        # Map model labels to readable names
        LABEL_MAP = {"ang": "angry", "hap": "happy", "sad": "sad", "neu": "neutral"}

        emotion_probs = {}
        for item in results:
            mapped = LABEL_MAP.get(item["label"], item["label"])
            emotion_probs[mapped] = float(item["score"])

        # Ensure all 4 emotions present
        for emo in ["angry", "happy", "sad", "neutral"]:
            if emo not in emotion_probs:
                emotion_probs[emo] = 0.0

        # Dominant emotion
        dominant = max(emotion_probs, key=emotion_probs.get)
        dominant_score = emotion_probs[dominant]

        # Burnout-relevant indicators
        emotional_exhaustion_score = (
            emotion_probs.get("sad", 0.0) * 0.6 +
            (1.0 - emotion_probs.get("happy", 0.0)) * 0.4
        )

        depersonalization_score = (
            emotion_probs.get("angry", 0.0) * 0.5 +
            emotion_probs.get("sad", 0.0) * 0.3 +
            (1.0 - emotion_probs.get("happy", 0.0)) * 0.2
        )

        result = {
            "emotions": emotion_probs,
            "dominant_emotion": dominant,
            "dominant_score": float(dominant_score),
            "emotional_exhaustion_score": float(emotional_exhaustion_score),
            "depersonalization_score": float(depersonalization_score),
        }

        print(f"Emotion: {dominant} (score={dominant_score:.3f}), "
              f"exhaustion={emotional_exhaustion_score:.3f}")

        return result

    except Exception as e:
        print(f"Error extracting emotion: {e}")
        raise
