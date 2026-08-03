import re
import numpy as np
from textblob import TextBlob


# ── English lexicons (exact token match) ────────────────────────────────────
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

POSITIVE_EMOTION_WORDS = {
    "happy", "calm", "relaxed", "motivated", "confident", "satisfied",
    "energetic", "productive", "grateful", "proud", "hopeful", "glad",
    "enjoy", "love", "wonderful", "great", "good", "excited", "inspired"
}

HEDGING_SINGLE = {
    "maybe", "perhaps", "might", "possibly", "probably",
    "somewhat", "likely", "unlikely", "apparently"
}
HEDGING_PHRASES = {
    "kind of", "sort of", "i guess", "i think", "not sure", "i suppose"
}

FIRST_PERSON_PRONOUNS = {
    "i", "me", "my", "mine", "myself", "i'm", "i've", "i'll", "i'd"
}


# ── Russian / Kazakh lexicons ────────────────────────────────────────────────
# Cyrillic is morphologically rich, so we match by STEM PREFIX (token.startswith)
# rather than exact equality, to catch inflected forms (устал/устала/устали…).
RU_KZ_ABSOLUT_STEMS = {
    # Russian
    "всегда", "никогда", "совершенно", "полностью", "должен", "должна",
    "все", "всё", "ничего", "ничто", "постоянн", "абсолютн", "обязательн",
    "невозможн", "навсегда", "кажд", "весь", "вся",
    # Kazakh
    "әрқашан", "ешқашан", "мүлдем", "толық", "әрдайым", "барлық",
    "ешқандай", "ештеңе", "әрқайсы", "әрбір", "бүкіл",
}

RU_KZ_NEGATIVE_STEMS = {
    # Russian
    "устал", "утомл", "измотан", "истощ", "стресс", "фрустр", "перегруж",
    "выгор", "депресс", "тревог", "безнадеж", "безнадёж", "несчаст",
    "опустош", "ненави", "ужасн", "раздраж", "злюсь", "беспомощ",
    "бесполезн", "разочаров", "отвращ", "скучн", "одинок", "груст",
    "больн", "страда", "мучаюс", "мучитель", "бор", "провал", "сломл",
    "тяжел", "плох", "надоел", "вымат", "напряж", "нервнича", "паник",
    "виноват", "апат",
    # Kazakh
    "шарша", "күйзел", "үрей", "мазас", "түңіл", "бақытсыз", "нашар",
    "ашулан", "дәрменс", "пайдас", "жалық", "жалғыз", "мұң", "ауыр",
    "азап", "қинал",
}

RU_KZ_POSITIVE_STEMS = {
    # Russian
    "хорош", "отличн", "рад", "счастл", "любл", "нрав", "доволь",
    "споко", "увер", "интересн", "вдохнов", "благодар", "прекрасн",
    "замечательн", "успех", "успешн", "горжус", "горд", "мотив",
    "энерг", "продуктивн", "полезн", "приятн", "комфорт", "надежд",
    "оптимист", "удовлетвор",
    # Kazakh
    "жақсы", "тамаша", "қуан", "бақыт", "ұна", "риза", "сенім",
    "қызық", "шабыт", "керемет", "табыс", "мақтан", "ынталан",
    "пайдалы", "жайлы", "үміт",
}

RU_KZ_HEDGE_SINGLE = {
    "может", "возможно", "наверное", "вероятно", "кажется", "видимо",
    "мүмкін", "бәлкім", "сірә", "меніңше",
}
RU_KZ_HEDGE_PHRASES = {
    "может быть", "по-видимому", "скорее всего", "не уверен", "не уверена",
    "как бы", "сенімді емес",
}

RU_KZ_FIRST_PERSON = {
    "я", "мне", "меня", "мной", "мой", "моя", "мои", "моё", "моих",
    "моего", "моей", "себя", "мен", "маған", "мені", "менің", "өзім",
}

_CYRILLIC_RE = re.compile(r"[а-яёәіңғүұқөһ]", re.IGNORECASE)


def _has_cyrillic(text: str) -> bool:
    return bool(_CYRILLIC_RE.search(text))


def _stem_hits(words, stems) -> int:
    return sum(1 for w in words if any(w.startswith(s) for s in stems))


def _ru_kz_sentiment(words):
    """Lexicon-based polarity/subjectivity for Cyrillic text (TextBlob only
    handles English). Returns (polarity in [-1, 1], subjectivity in [0, 1])."""
    pos = _stem_hits(words, RU_KZ_POSITIVE_STEMS)
    neg = _stem_hits(words, RU_KZ_NEGATIVE_STEMS)
    total_sentiment = pos + neg
    if total_sentiment == 0:
        return 0.0, 0.0
    polarity = (pos - neg) / total_sentiment
    subjectivity = min(total_sentiment / max(len(words), 1), 1.0)
    return float(polarity), float(subjectivity)


def extract_text_features(text: str) -> dict:
    try:
        text_lower = text.lower().strip()
        words = text_lower.split()
        total_words = len(words)

        if total_words == 0:
            return _empty_features()

        # Sentiment: lexicon for Cyrillic (RU/KZ), TextBlob for English.
        if _has_cyrillic(text_lower):
            sentiment_polarity, sentiment_subjectivity = _ru_kz_sentiment(words)
        else:
            blob = TextBlob(text)
            sentiment_polarity = float(blob.sentiment.polarity)
            sentiment_subjectivity = float(blob.sentiment.subjectivity)

        absolutist_count = (
            sum(1 for w in words if w in ABSOLUTIST_WORDS)
            + _stem_hits(words, RU_KZ_ABSOLUT_STEMS)
        )
        absolutist_index = absolutist_count / total_words

        pronoun_count = sum(
            1 for w in words if w in FIRST_PERSON_PRONOUNS or w in RU_KZ_FIRST_PERSON
        )
        first_person_ratio = pronoun_count / total_words

        negative_count = (
            sum(1 for w in words if w in NEGATIVE_EMOTION_WORDS)
            + _stem_hits(words, RU_KZ_NEGATIVE_STEMS)
        )
        negative_ratio = negative_count / total_words

        hedging_count = (
            sum(1 for w in words if w in HEDGING_SINGLE or w in RU_KZ_HEDGE_SINGLE)
            + sum(1 for p in HEDGING_PHRASES if p in text_lower)
            + sum(1 for p in RU_KZ_HEDGE_PHRASES if p in text_lower)
        )
        hedging_ratio = hedging_count / total_words

        word_count = total_words
        avg_word_length = float(np.mean([len(w) for w in words]))

        features = {
            "sentiment_polarity": float(sentiment_polarity),
            "sentiment_subjectivity": float(sentiment_subjectivity),
            "absolutist_index": float(absolutist_index),
            "first_person_ratio": float(first_person_ratio),
            "negative_word_ratio": float(negative_ratio),
            "hedging_ratio": float(hedging_ratio),
            "word_count": word_count,
            "avg_word_length": avg_word_length,
        }

        print(f"Text features: sentiment={sentiment_polarity:.3f}, "
              f"absolutist={absolutist_index:.3f}, "
              f"negative={negative_ratio:.3f}, "
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
