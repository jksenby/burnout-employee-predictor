import torch
from transformers import WavLMModel, Wav2Vec2Processor
import librosa

processor = Wav2Vec2Processor.from_pretrained("microsoft/wavlm-base-plus")
model = WavLMModel.from_pretrained("microsoft/wavlm-base-plus")

def extract_acoustic_features(audio_path):
    audio, sr = librosa.load(audio_path, sr=16000)

    inputs = processor(audio, return_tensors="pt", sampling_rate=16000)
    with torch.no_grad():
        outputs = model(**inputs)

    last_hidden_plate = outputs.last_hidden_state

    acoustic_embedding = torch.mean(last_hidden_plate, dim=1)

    return acoustic_embedding