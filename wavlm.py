import torch
import torchaudio
import soundfile as sf
import io
import numpy as np
from transformers import Wav2Vec2FeatureExtractor, WavLMModel

_feature_extractor = None
_model = None
_device = None

def _load_model():
    global _feature_extractor, _model, _device

    if _model is None:
        print("Loading WavLM model...")
        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        model_name = "microsoft/wavlm-base"
        _feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(model_name)
        _model = WavLMModel.from_pretrained(model_name)
        _model.to(_device)
        _model.eval()

        print(f"WavLM loaded on {_device}")

    return _feature_extractor, _model, _device

def extract_embedding(audio_bytes: bytes) -> list:
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

        print(f"Extracted embedding: shape={len(embedding_list)}, norm={np.linalg.norm(embedding_list):.2f}")
        
        return embedding_list
    
    except Exception as e:
        print(f"Error extracting embedding: {e}")
        raise