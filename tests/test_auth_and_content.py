"""Аутентификация, MBI и банк вопросов."""

from datetime import timedelta

import pytest
from jose import jwt

import auth
from questions import CORE_QUESTIONS, get_questions_for_week
from survey import MBIProcessor


def test_password_roundtrip():
    hashed = auth.hash_password("correct horse")

    assert hashed != "correct horse"
    assert auth.verify_password("correct horse", hashed)
    assert not auth.verify_password("wrong", hashed)


def test_long_passwords_are_truncated_consistently():
    # bcrypt учитывает только первые 72 байта; новые версии падают на длинных.
    long_pw = "x" * 100

    assert auth.verify_password(long_pw, auth.hash_password(long_pw))


def test_access_token_contains_subject_and_expiry():
    token = auth.create_access_token({"sub": "alice"}, timedelta(minutes=5))
    payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])

    assert payload["sub"] == "alice"
    assert "exp" in payload


def test_expired_token_is_rejected():
    token = auth.create_access_token({"sub": "alice"}, timedelta(seconds=-1))

    with pytest.raises(jwt.ExpiredSignatureError):
        jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])


def _answers(value):
    return {i: value for i in range(1, 23)}


def test_mbi_subscales_cover_all_22_items():
    items = sorted(i for idx in MBIProcessor().indices.values() for i in idx)

    assert items == list(range(1, 23))


def test_mbi_low_and_high_risk():
    proc = MBIProcessor()

    low = proc.get_burnout_status(_answers(0))
    high = proc.get_burnout_status(_answers(4))

    assert low["risk"] == "NORMAL"
    assert high["risk"] == "HIGH"
    assert high["details"] == {"EE": 36, "DP": 20, "PA": 32}


@pytest.mark.parametrize("week, same_as", [(1, 1), (8, 8), (9, 1), (17, 1)])
def test_question_rotation_cycles_every_8_weeks(week, same_as):
    assert get_questions_for_week(week)["variative"] == \
        get_questions_for_week(same_as)["variative"]


def test_core_questions_always_present():
    for week in range(1, 10):
        q = get_questions_for_week(week)

        assert q["core"] == CORE_QUESTIONS
        assert q["week_number"] == week
        assert len(q["variative"]) == 3
