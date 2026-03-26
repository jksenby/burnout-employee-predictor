import torch
import io
import numpy as np
import soundfile as sf
import torchaudio
from transformers import HubertModel, Wav2Vec2FeatureExtractor

_feature_extractor = None
_model = None
_device = None


def _load_model():
    global _feature_extractor, _model, _device

    if _model is None:
        print("Loading HuBERT model...")
        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        model_name = "facebook/hubert-base-ls960"
        _feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(model_name)
        _model = HubertModel.from_pretrained(model_name)
        _model.to(_device)
        _model.eval()

        print(f"HuBERT loaded on {_device}")

    return _feature_extractor, _model, _device


def extract_hubert_embedding(audio_bytes: bytes) -> list:
    try:
        feature_extractor, model, device = _load_model()

        audio_buffer = io.BytesIO(audio_bytes)
        waveform, sample_rate = sf.read(audio_buffer, dtype="float32")

        if len(waveform.shape) > 1:
            waveform = waveform.mean(axis=1)

        target_sr = 16000
        if sample_rate != target_sr:
            waveform = torch.tensor(waveform).unsqueeze(0)
            resampler = torchaudio.transforms.Resample(sample_rate, target_sr)
            waveform = resampler(waveform).squeeze(0).numpy()

        inputs = feature_extractor(
            waveform,
            sampling_rate=target_sr,
            return_tensors="pt",
            padding=True
        )

        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model(**inputs)
            hidden_states = outputs.last_hidden_state
            embedding = hidden_states.mean(dim=1)

        embedding_list = embedding.squeeze(0).cpu().numpy().tolist()

        print(f"HuBERT embedding: shape={len(embedding_list)}, "
              f"norm={np.linalg.norm(embedding_list):.2f}")

        return embedding_list

    except Exception as e:
        print(f"Error extracting HuBERT embedding: {e}")
        raise
