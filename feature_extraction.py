import numpy as np
import librosa
import io
import soundfile as sf


def extract_acoustic_features(audio_bytes: bytes) -> dict:
    try:
        audio_buffer = io.BytesIO(audio_bytes)
        y, sr = sf.read(audio_buffer, dtype="float32")

        if len(y.shape) > 1:
            y = y.mean(axis=1)

        if sr != 16000:
            y = librosa.resample(y, orig_sr=sr, target_sr=16000)
            sr = 16000

        features = {}

        f0, voiced_flag, voiced_probs = librosa.pyin(
            y, fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=sr
        )
        f0_valid = f0[~np.isnan(f0)] if f0 is not None else np.array([0.0])
        if len(f0_valid) == 0:
            f0_valid = np.array([0.0])

        features["pitch_mean"] = float(np.mean(f0_valid))
        features["pitch_std"] = float(np.std(f0_valid))
        features["pitch_range"] = float(np.ptp(f0_valid))
        features["pitch_median"] = float(np.median(f0_valid))

        rms = librosa.feature.rms(y=y)[0]
        features["energy_mean"] = float(np.mean(rms))
        features["energy_std"] = float(np.std(rms))
        features["energy_max"] = float(np.max(rms))

        if len(f0_valid) > 1:
            pitch_diffs = np.abs(np.diff(f0_valid))
            jitter = float(np.mean(pitch_diffs) / (np.mean(f0_valid) + 1e-10))
        else:
            jitter = 0.0
        features["jitter"] = jitter

        if len(rms) > 1:
            amp_diffs = np.abs(np.diff(rms))
            shimmer = float(np.mean(amp_diffs) / (np.mean(rms) + 1e-10))
        else:
            shimmer = 0.0
        features["shimmer"] = shimmer

        harmonic, percussive = librosa.effects.hpss(y)
        harmonic_energy = np.sum(harmonic ** 2) + 1e-10
        noise_energy = np.sum(percussive ** 2) + 1e-10
        hnr = float(10 * np.log10(harmonic_energy / noise_energy))
        features["hnr"] = hnr

        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        onsets = librosa.onset.onset_detect(
            onset_envelope=onset_env, sr=sr, backtrack=False
        )
        duration = len(y) / sr
        speech_rate = float(len(onsets) / duration) if duration > 0 else 0.0
        features["speech_rate"] = speech_rate

        frame_length = 2048
        hop_length = 512
        energy_frames = librosa.feature.rms(
            y=y, frame_length=frame_length, hop_length=hop_length
        )[0]
        silence_threshold = 0.01 * np.max(energy_frames)
        silent_frames = np.sum(energy_frames < silence_threshold)
        total_frames = len(energy_frames)
        pause_ratio = float(silent_frames / total_frames) if total_frames > 0 else 0.0
        features["pause_ratio"] = pause_ratio

        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        features["spectral_centroid_mean"] = float(np.mean(centroid))
        features["spectral_centroid_std"] = float(np.std(centroid))

        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        for i in range(13):
            features[f"mfcc_{i}_mean"] = float(np.mean(mfccs[i]))
            features[f"mfcc_{i}_std"] = float(np.std(mfccs[i]))

        print(f"Acoustic features extracted: {len(features)} features")
        return features

    except Exception as e:
        print(f"Error extracting acoustic features: {e}")
        raise
