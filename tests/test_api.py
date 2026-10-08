"""Сквозные тесты HTTP API (main.py).

Нейросетевые потоки (HuBERT, WavLM, wav2vec2-эмоции, Whisper) подменяются
заглушками: в CI нет PyTorch и весов моделей. Всё остальное — декодирование
аудио, Praat-признаки, текстовые признаки, обученный классификатор, личная
норма, БД и генерация отчёта — работает по-настоящему.
"""

import importlib
import io
import sys
import types

import numpy as np
import pytest
import soundfile as sf
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

EMBEDDING_DIM = 768


def _stub_module(name, **attrs):
    module = types.ModuleType(name)
    for key, value in attrs.items():
        setattr(module, key, value)
    return module


def _fake_embedding(audio_bytes):
    rng = np.random.default_rng(len(audio_bytes))
    return rng.normal(0, 0.2, EMBEDDING_DIM).tolist()


def _fake_emotion(audio_bytes):
    return {
        "emotions": {"angry": 0.1, "happy": 0.2, "sad": 0.3, "neutral": 0.4},
        "dominant_emotion": "neutral",
        "emotional_exhaustion_score": 0.4,
    }


STUBS = {
    "hubert": _stub_module("hubert", extract_hubert_embedding=_fake_embedding),
    "wavlm": _stub_module("wavlm", extract_embedding=_fake_embedding),
    "emotion": _stub_module("emotion", extract_emotion=_fake_emotion),
    "speech_transcriber": _stub_module(
        "speech_transcriber",
        transcribe_bytes=lambda audio_bytes: "Я сегодня немного устал, но в целом всё хорошо",
    ),
}


@pytest.fixture(scope="module")
def app_module():
    """Импортирует main.py с заглушками нейросетей и БД в памяти."""
    saved = {name: sys.modules.get(name) for name in [*STUBS, "main"]}
    sys.modules.update(STUBS)
    sys.modules.pop("main", None)

    import database

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    orig_engine, orig_session = database.engine, database.SessionLocal
    database.engine = engine
    database.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    main = importlib.import_module("main")
    yield main

    database.engine, database.SessionLocal = orig_engine, orig_session
    for name, module in saved.items():
        if module is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = module


@pytest.fixture(scope="module")
def client(app_module):
    from fastapi.testclient import TestClient

    return TestClient(app_module.app)


_user_counter = iter(range(10_000))


@pytest.fixture
def auth_headers(client):
    n = next(_user_counter)
    user = {
        "username": f"tester{n}",
        "email": f"tester{n}@example.com",
        "password": "s3cret-pass",
        "gender": "female",
        "phone_number": "+70000000000",
        "age": 30,
    }
    assert client.post("/auth/register", json=user).status_code == 201
    resp = client.post("/auth/login", json={"username": user["username"],
                                           "password": user["password"]})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture(scope="module")
def wav_bytes():
    sr = 16000
    t = np.arange(6 * sr) / sr
    f0 = 140.0 + 20.0 * np.sin(2 * np.pi * 0.5 * t)
    phase = 2 * np.pi * np.cumsum(f0) / sr
    y = sum(np.sin(k * phase) / k for k in range(1, 6))
    envelope = 0.5 + 0.5 * np.sin(2 * np.pi * 4.0 * t) ** 2
    envelope[(t % 1.5) > 1.2] = 0.0
    y = (0.2 * y * envelope / np.max(np.abs(y))).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, y, sr, format="WAV")
    return buf.getvalue()


def _mbi_answers(value):
    return {"answers": {f"q{i}": value for i in range(22)}}


def test_root(client):
    resp = client.get("/")

    assert resp.status_code == 200
    assert "Burnout" in resp.json()["message"]


def test_duplicate_registration_rejected(client, auth_headers):
    me = client.get("/auth/me", headers=auth_headers).json()
    dup = {"username": me["username"], "email": "other@example.com",
           "password": "x", "gender": "male", "phone_number": "1", "age": 40}

    assert client.post("/auth/register", json=dup).status_code == 400


def test_wrong_password_rejected(client, auth_headers):
    me = client.get("/auth/me", headers=auth_headers).json()
    resp = client.post("/auth/login", json={"username": me["username"], "password": "nope"})

    assert resp.status_code == 401


def test_protected_endpoint_requires_token(client):
    assert client.get("/history").status_code == 401


def test_mbi_scoring(client, auth_headers):
    resp = client.post("/mbi/submit", json=_mbi_answers(2), headers=auth_headers)
    body = resp.json()

    assert resp.status_code == 200
    assert body["emotional_exhaustion"] == 18   # 9 вопросов × 2
    assert body["depersonalization"] == 10      # 5 × 2
    assert body["personal_accomplishment"] == 16  # 8 × 2
    assert 0.0 <= body["burnout_index"] <= 1.0


def test_incomplete_mbi_rejected(client, auth_headers):
    payload = {"answers": {f"q{i}": 1 for i in range(10)}}

    assert client.post("/mbi/submit", json=payload, headers=auth_headers).status_code == 422


def test_interview_prediction(client, auth_headers, wav_bytes):
    resp = client.post(
        "/predict/interview",
        files={"file": ("rec.wav", wav_bytes, "audio/wav")},
        headers=auth_headers,
    )
    body = resp.json()

    assert resp.status_code == 200, body
    assert body["label"] in {"Low Risk", "Medium Risk", "High Risk"}
    assert body["transcript"]
    assert body["baseline"]["status"] == "calibrating"


def test_invalid_audio_is_400_not_500(client, auth_headers):
    resp = client.post(
        "/predict/reading",
        files={"file": ("rec.wav", b"not a wav file", "audio/wav")},
        headers=auth_headers,
    )

    assert resp.status_code == 400


def test_report_closed_until_protocol_complete(client, auth_headers):
    assert client.get("/report/pdf", headers=auth_headers).status_code == 403


def test_full_protocol_produces_report(client, app_module, auth_headers, wav_bytes):
    """Регрессия: /report/pdf падал с NameError (mbi_count/speech_count)
    ровно тогда, когда пользователь набирал допуск к отчёту."""
    for value in (1, 3):
        client.post("/mbi/submit", json=_mbi_answers(value), headers=auth_headers)

    for mode in ("interview", "reading"):
        for i in range(app_module.REQUIRED_SPEECH_PER_MODE):
            resp = client.post(
                f"/predict/{mode}",
                files={"file": (f"{mode}{i}.wav", wav_bytes, "audio/wav")},
                headers=auth_headers,
            )
            assert resp.status_code == 200, resp.json()

    # После калибровки появляется отклонение от личной нормы.
    assert resp.json()["baseline"]["status"] == "active"

    data = client.get("/report/data", headers=auth_headers)
    assert data.status_code == 200

    pdf = client.get("/report/pdf", headers=auth_headers)
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF")
