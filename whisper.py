import whisper

whisper_model = whisper.load_model("base")

ABSOLUTIST_WORDS = {
    "always", "never", "completely", "totally", "must", "everyone",
    "everything", "nothing", "constant", "definite", "entire"
}

def extract_linguistic_features(audio_path):
    result = whisper_model.transcribe(audio_path)
    text = result["text"].lower()

    words = text.split()
    total_words = len(words)
    if(total_words == 0): return 0, text

    absolutist_count = sum(1 for word in words if word in ABSOLUTIST_WORDS)
    absolutist_index = absolutist_count / total_words

    return absolutist_index, text