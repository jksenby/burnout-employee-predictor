from textblob import TextBlob


ABSOLUTIST_WORDS = {
    "always", "never", "completely", "totally", "must", "everyone",
    "everything", "nothing", "constant", "definite", "entire",
    "absolutely", "certainly", "impossible", "forever", "all"
}

NEGATIVE_EMOTION_WORDS = {
    "tired", "exhausted", "stressed", "frustrated", "overwhelmed",
    "burned", "burnout", "depressed", "anxious", "hopeless",
    "miserable", "drained", "hate", "terrible", "awful",
    "irritated", "angry", "helpless", "worthless", "useless",
    "disappointed", "disgusted", "bored", "lonely", "sad",
    "painful", "suffering", "struggling", "failing", "broken"
}

HEDGING_WORDS = {
    "maybe", "perhaps", "might", "possibly", "probably",
    "somewhat", "kind of", "sort of", "i guess", "i think",
    "not sure", "i suppose", "likely", "unlikely", "apparently"
}

FIRST_PERSON_PRONOUNS = {
    "i", "me", "my", "mine", "myself", "i'm", "i've", "i'll", "i'd"
}


def extract_text_features(text: str) -> dict:
    try:
        text_lower = text.lower().strip()
        words = text_lower.split()
        total_words = len(words)

        if total_words == 0:
            return _empty_features()

        blob = TextBlob(text)
        sentiment_polarity = float(blob.sentiment.polarity)
        sentiment_subjectivity = float(blob.sentiment.subjectivity)

        absolutist_count = sum(1 for w in words if w in ABSOLUTIST_WORDS)
        absolutist_index = absolutist_count / total_words

        pronoun_count = sum(1 for w in words if w in FIRST_PERSON_PRONOUNS)
        first_person_ratio = pronoun_count / total_words

        negative_count = sum(1 for w in words if w in NEGATIVE_EMOTION_WORDS)
        negative_ratio = negative_count / total_words

        hedging_count = sum(
            1 for phrase in HEDGING_WORDS
            if phrase in text_lower
        )
        hedging_ratio = hedging_count / total_words

        word_count = total_words
        avg_word_length = float(
            np.mean([len(w) for w in words])
        ) if total_words > 0 else 0.0

        features = {
            "sentiment_polarity": sentiment_polarity,
            "sentiment_subjectivity": sentiment_subjectivity,
            "absolutist_index": float(absolutist_index),
            "first_person_ratio": float(first_person_ratio),
            "negative_word_ratio": float(negative_ratio),
            "hedging_ratio": float(hedging_ratio),
            "word_count": word_count,
            "avg_word_length": avg_word_length,
        }

        print(f"Text features: sentiment={sentiment_polarity:.3f}, "
              f"absolutist={absolutist_index:.3f}, "
              f"words={word_count}")

        return features

    except Exception as e:
        print(f"Error extracting text features: {e}")
        raise


def _empty_features() -> dict:
    return {
        "sentiment_polarity": 0.0,
        "sentiment_subjectivity": 0.0,
        "absolutist_index": 0.0,
        "first_person_ratio": 0.0,
        "negative_word_ratio": 0.0,
        "hedging_ratio": 0.0,
        "word_count": 0,
        "avg_word_length": 0.0,
    }


import numpy as np
