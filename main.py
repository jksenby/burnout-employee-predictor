from fastapi import FastAPI, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import traceback
from datetime import datetime, timezone, timedelta

from hubert import extract_hubert_embedding
from wavlm import extract_embedding as extract_wavlm_embedding
from feature_extraction import extract_acoustic_features, FEATURE_SCHEMA_VERSION
from audio_io import (
    decode_audio, validate_audio, validate_voicing, AudioValidationError,
)
from emotion import extract_emotion
from speech_transcriber import transcribe_bytes
from text_features import extract_text_features
from model import predict, check_feature_schema
from analysis import (
    build_baseline, evaluate as evaluate_baseline,
    BASELINE_WINDOW_SESSIONS, MIN_BASELINE_SESSIONS,
)
from questions import get_questions_for_week

from database import engine, Base, get_db
from models_db import User, SpeechAnalysis, MBIResult
from sqlalchemy import text, inspect as sa_inspect
from schemas import MBISubmit, MBIResponse, HistoryResponse, ScheduleResponse, SpeechAnalysisResponse, ReportResponse
from sqlalchemy.orm import Session
from fastapi import Depends
from fastapi.responses import StreamingResponse
from fpdf import FPDF
import io
import os
from auth import get_current_user, get_optional_user
from routes.auth import router as auth_router

Base.metadata.create_all(bind=engine)

# Lightweight column migration for existing tables. SQLAlchemy's
# create_all() only creates missing tables — it never ALTERs existing ones —
# so newly-added columns must be backfilled here for already-populated DBs.
def _migrate_columns(table: str, new_cols: dict):
    inspector = sa_inspect(engine)
    existing = {col["name"] for col in inspector.get_columns(table)}
    with engine.connect() as conn:
        for col_name, col_type in new_cols.items():
            if col_name not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"))
        conn.commit()

_migrate_columns("users", {
    "profession": "VARCHAR",
    "workplace": "VARCHAR",
    "work_experience": "INTEGER",
    "education_level": "VARCHAR",
    "education_place": "VARCHAR",
    "specialty": "VARCHAR",
    "city": "VARCHAR",
})
_migrate_columns("speech_analyses", {
    "model_type": "VARCHAR",
    "feature_schema": "INTEGER",
    "baseline_status": "VARCHAR",
    "baseline_deviation": "FLOAT",
    "baseline_deltas": "JSON",
    "baseline_n": "INTEGER",
    "baseline_warning": "BOOLEAN",
})

check_feature_schema(FEATURE_SCHEMA_VERSION)

app = FastAPI(title="Burnout Predictor API — Multimodal Late Fusion")

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])

@app.get("/")
async def root():
    return {
        "message": "Burnout Predictor API — Multimodal Late Fusion",
        "streams": [
            "HuBERT (Acoustics/Emotion)",
            "WavLM (Prosody/Noise-robust)",
            "Faster-Whisper (Semantics/Multilingual)"
        ],
        "version": "2.0"
    }


async def _run_speech_pipeline(audio_bytes: bytes, filename: str, include_transcript: bool = True) -> dict:
    # Проверки идут ДО нейросетей. Личная норма голоса фиксируется по первым
    # сессиям и потом не пересчитывается, поэтому непригодную запись нельзя
    # молча превращать в нули — она навсегда испортит референс.
    y, sr = decode_audio(audio_bytes)
    validate_audio(y, sr)

    # Акустика считается первой и служит вторым фильтром качества: Praat быстрый,
    # а HuBERT + WavLM + wav2vec2 + Whisper — нет. Отклонять шум, музыку и шёпот
    # дешевле до них, а не после.
    acoustic_features = extract_acoustic_features(y, sr)
    validate_voicing(acoustic_features["voiced_fraction"])

    hubert_embedding = extract_hubert_embedding(audio_bytes)

    print("[Stream 1] wav2vec2 — emotion recognition...")
    emotion_result = extract_emotion(audio_bytes)
    wavlm_embedding = extract_wavlm_embedding(audio_bytes)

    if include_transcript:
        transcript = transcribe_bytes(audio_bytes)
        text_feat = extract_text_features(transcript)
    else:
        transcript = None
        text_feat = {}

    result = predict(
        hubert_embedding=hubert_embedding,
        wavlm_embedding=wavlm_embedding,
        acoustic_features=acoustic_features,
        emotion_result=emotion_result,
        text_features=text_feat,
    )

    result["filename"] = filename
    result["file_size_bytes"] = len(audio_bytes)
    result["transcript"] = transcript
    # Версия схемы обязательна: личная норма сравнивает абсолютные величины, а
    # v1 считалась другими формулами (см. FEATURE_SCHEMA_VERSION). Смешивать
    # записи разных версий в одной норме нельзя.
    result["feature_schema"] = FEATURE_SCHEMA_VERSION
    result["acoustic_features"] = {
        "pitch_mean": acoustic_features.get("pitch_mean", 0),
        "pitch_std": acoustic_features.get("pitch_std", 0),
        "pitch_range": acoustic_features.get("pitch_range", 0),
        "energy_mean": acoustic_features.get("energy_mean", 0),
        "energy_std": acoustic_features.get("energy_std", 0),
        "jitter": acoustic_features.get("jitter", 0),
        "shimmer": acoustic_features.get("shimmer", 0),
        "hnr": acoustic_features.get("hnr", 0),
        "speech_rate": acoustic_features.get("speech_rate", 0),
        "pause_ratio": acoustic_features.get("pause_ratio", 0),
        "spectral_centroid_mean": acoustic_features.get("spectral_centroid_mean", 0),
        # Метрики качества записи, не признаки модели.
        "duration_sec": acoustic_features.get("duration_sec", 0),
        "voiced_fraction": acoustic_features.get("voiced_fraction", 0),
    }

    return result


def _attach_baseline(db, current_user, result: dict, analysis_type: str) -> None:
    """Сравнивает запись с личной нормой пользователя в том же режиме.

    Норма строится по первым BASELINE_WINDOW_SESSIONS сессиям ИМЕННО ЭТОГО
    режима: интервью и чтение акустически несопоставимы (в чтении текст задан
    заранее, нет пауз на обдумывание и нет своей лексики), поэтому у них
    отдельные нормы.

    Текущая запись ещё не сохранена, поэтому выборка ниже — строго предыдущие
    сессии. Первые три записи попадают в статус "calibrating", с четвёртой
    появляется оценка. До шестой записи окно ещё доукомплектовывается, поэтому
    ранние точки опираются на более короткую норму — размер окна сохраняется в
    baseline_n, чтобы это было видно в отчёте.
    """
    calibration = db.query(SpeechAnalysis)\
        .filter(
            SpeechAnalysis.user_id == current_user.id,
            SpeechAnalysis.analysis_type == analysis_type,
            # Только записи текущей схемы признаков: в v1 jitter/shimmer/HNR и
            # темп речи считались другими формулами и лежат в других шкалах.
            # Смешав версии, мы получили бы отклонение от несуществующей нормы.
            SpeechAnalysis.feature_schema == FEATURE_SCHEMA_VERSION,
        )\
        .order_by(SpeechAnalysis.created_at.asc())\
        .limit(BASELINE_WINDOW_SESSIONS)\
        .all()

    baseline = build_baseline([a.acoustic_features for a in calibration])
    result["baseline"] = evaluate_baseline(baseline, result["acoustic_features"])


def _save_speech_analysis(db, current_user, result: dict, *, analysis_type: str,
                           fatigue_level, stress_events, week_number=None):
    baseline = result.get("baseline") or {}
    db_analysis = SpeechAnalysis(
        user_id=current_user.id,
        filename=result["filename"],
        file_size_bytes=result["file_size_bytes"],
        transcript=result["transcript"],
        label=result["label"],
        score=result["score"],
        confidence=result.get("confidence", 0.0),
        probabilities=result.get("probabilities", {}),
        stream_contributions=result.get("stream_contributions", {}),
        emotions=result.get("emotions", {}),
        dominant_emotion=result.get("dominant_emotion", "unknown"),
        model_type=result.get("model_type", "unknown"),
        text_analysis=result.get("text_analysis", {}),
        acoustic_features=result["acoustic_features"],
        feature_schema=result.get("feature_schema"),
        baseline_status=baseline.get("status"),
        baseline_deviation=baseline.get("deviation_score"),
        baseline_deltas=baseline.get("deltas", {}),
        baseline_n=baseline.get("n_baseline"),
        baseline_warning=baseline.get("is_warning", False),
        fatigue_level=fatigue_level,
        stress_events=stress_events,
        week_number=week_number,
        analysis_type=analysis_type,
    )
    db.add(db_analysis)
    db.commit()


@app.post("/predict/interview")
async def predict_interview(
    file: UploadFile,
    fatigue_level: int | None = Form(None),
    stress_events: bool | None = Form(None),
    week_number: int | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user)
):
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file uploaded")
        audio_bytes = await file.read()
        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file")

        result = await _run_speech_pipeline(audio_bytes, file.filename)

        if current_user:
            _attach_baseline(db, current_user, result, "interview")
            _save_speech_analysis(
                db, current_user, result,
                analysis_type="interview",
                fatigue_level=fatigue_level,
                stress_events=stress_events,
                week_number=week_number,
            )

        return result

    except AudioValidationError as e:
        # Проблема во входных данных, а не на сервере — 400, чтобы фронт мог
        # показать пользователю понятную причину и попросить перезаписать.
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/reading")
async def predict_reading(
    file: UploadFile,
    fatigue_level: int | None = Form(None),
    stress_events: bool | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user)
):
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file uploaded")
        audio_bytes = await file.read()
        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file")

        result = await _run_speech_pipeline(audio_bytes, file.filename, include_transcript=False)

        if current_user:
            _attach_baseline(db, current_user, result, "reading")
            _save_speech_analysis(
                db, current_user, result,
                analysis_type="reading",
                fatigue_level=fatigue_level,
                stress_events=stress_events,
            )

        return result

    except AudioValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/mbi/submit", response_model=MBIResponse)
async def submit_mbi(
    payload: MBISubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Полнота и диапазон ответов проверены в MBISubmit, поэтому обращаемся
        # по ключу напрямую. Прежний answers.get(f"q{i}", 0) молча подставлял
        # ноль за пропуск и выдавал осмысленно выглядящий индекс из неполных
        # данных.
        answers = payload.answers
        ee_indices = [0, 1, 2, 5, 7, 12, 13, 15, 19]
        dp_indices = [4, 9, 10, 14, 21]
        pa_indices = [3, 6, 8, 11, 16, 17, 18, 20]

        ee_score = sum(answers[f"q{i}"] for i in ee_indices)
        dp_score = sum(answers[f"q{i}"] for i in dp_indices)
        pa_score = sum(answers[f"q{i}"] for i in pa_indices)
        reduction_score = 32 - pa_score

        # SBSI = sqrt((EE/36)^2 + (DP/20)^2 + ((32-PA)/32)^2) / sqrt(3)
        sbsi = (
            ((ee_score / 36) ** 2 + (dp_score / 20) ** 2 + (reduction_score / 32) ** 2) / 3
        ) ** 0.5

        db_mbi = MBIResult(
            user_id=current_user.id,
            gender=current_user.gender,
            answers=answers,
            emotional_exhaustion=ee_score,
            depersonalization=dp_score,
            personal_accomplishment=pa_score,
            reduction_of_achievements=reduction_score,
            burnout_index=sbsi
        )
        db.add(db_mbi)
        db.commit()
        db.refresh(db_mbi)
        return db_mbi
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


MBI_CYCLE_DAYS = 60
SPEECH_CYCLE_DAYS = 7

# Окно отчёта должно накрывать ВЕСЬ протокол и оставаться открытым ПОСЛЕ его
# конца: отчёт нужен не только в день последней записи. Прежние значения
# промахивались с двух сторон. 8 недель (56 дней) обрезали второй MBI, который
# приходится на 60-й день, и динамика по опроснику молча исчезала из отчёта.
# MBI_CYCLE_DAYS + 30 = 90 дней протокол накрывали, но на 91-й день из окна
# выпадал ПЕРВЫЙ MBI: mbi_count падал до одного, допуск закрывался, и
# /report/pdf отдавал 403 по полностью собранному протоколу — то есть отчёт
# жил всего 30 дней после последнего замера.
REPORT_WINDOW_DAYS = 365

# Минимум точек, ниже которого говорить о тренде нельзя — только о разнице
# двух замеров. Две точки всегда дают идеальную прямую, это не тренд.
MIN_TREND_POINTS = 3
# Насколько подогнанная прямая должна сместиться ЗА ВСЁ окно наблюдения, чтобы
# считать ряд трендом. Порог задан на суммарный сдвиг, а не на наклон в неделю:
# при пороге на наклон ряд из значений ±0.02 (то есть весь внутри личной нормы)
# получал ярлык «улучшение» только потому, что три шумовые точки легли под
# небольшим уклоном. Все ряды здесь в шкале 0..1 либо -1..1.
MIN_TREND_TOTAL_CHANGE = 0.15

REQUIRED_MBI_COUNT = 2
# Требование к речи задано ПО РЕЖИМУ, а не суммой записей. Личная норма и её
# тренд считаются внутри режима (см. _attach_baseline), а прежний суммарный
# порог в 8 записей режимы не различал: набор «4 интервью + 4 чтения» его
# проходил, хотя в каждом режиме первые три сессии уходят в калибровку и на
# тренд остаётся одна точка — отчёт открывался без лонгитюдной части вообще.
# Минимум, при котором тренд в принципе возможен: калибровочные сессии плюс
# точки, которые нужны МНК.
REQUIRED_SPEECH_PER_MODE = MIN_BASELINE_SESSIONS + MIN_TREND_POINTS

# Пороги правила «семантика не подтверждает акустический риск».
CROSS_VAL_RISK_MIN = 0.6
CROSS_VAL_ABSOLUTIST_MAX = 0.05
CROSS_VAL_NEGATIVE_MAX = 0.05


def _as_utc(dt):
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _mean(values):
    values = [v for v in values if v is not None]
    return sum(values) / len(values) if values else None


def _active_deviations(items: list) -> list:
    """Отклонения от личной нормы только по записям с готовой нормой.

    Пока идёт калибровка (первые сессии), baseline_deviation отсутствует —
    такие записи в динамику не попадают вовсе, иначе начало наблюдения
    выглядело бы как нулевое отклонение, то есть как «всё в норме».

    Записи прежней схемы признаков тоже исключаются: их отклонения считались
    в других шкалах и в одном ряду с новыми несопоставимы.
    """
    return [
        s.baseline_deviation for s in items
        if s.baseline_status == "active"
        and s.baseline_deviation is not None
        and s.feature_schema == FEATURE_SCHEMA_VERSION
    ]


def _text_values(items: list, key: str) -> list:
    return [
        s.text_analysis[key] for s in items
        if s.text_analysis and s.text_analysis.get(key) is not None
    ]


def _baseline_summary(items: list) -> dict:
    """Состояние личной нормы по режиму: готова ли и каково последнее значение.

    Считаются только записи текущей схемы признаков. Записи прежней схемы
    показываются отдельным числом, чтобы в интерфейсе было видно, почему норма
    начала набираться заново.
    """
    current = [s for s in items if s.feature_schema == FEATURE_SCHEMA_VERSION]
    deviations = _active_deviations(items)

    if not current:
        status = "no_data"
    elif deviations:
        status = "active"
    elif current[-1].baseline_status == "unavailable":
        # Сессий хватает, но калибровочные записи вырожденные — пригодных
        # признаков меньше MIN_BASELINE_FEATURES. Ждать нечего, поэтому это не
        # «идёт калибровка»: иначе интерфейс написал бы «нужно ещё 0 записей».
        status = "unavailable"
    else:
        status = "calibrating"

    return {
        "status": status,
        "sessions": len(current),
        "legacy_sessions": len(items) - len(current),
        "active_sessions": len(deviations),
        "sessions_until_ready": (
            0 if status in ("active", "unavailable")
            else max(0, MIN_BASELINE_SESSIONS + 1 - len(current))
        ),
        "latest_deviation": deviations[-1] if deviations else None,
        "mean_deviation": _mean(deviations),
        "warning_sessions": sum(1 for s in current if s.baseline_warning),
    }


def _linear_trend(series: list) -> dict:
    """МНК-наклон ряда (индекс недели → значение).

    Заменяет прежнюю оценку «последнее минус первое»: та сравнивала два
    случайных замера и порог 0.05 срабатывал на обычном измерительном шуме.
    """
    points = [(x, y) for x, y in series if y is not None]
    n = len(points)
    if n < MIN_TREND_POINTS:
        return {"slope": None, "n_points": n, "direction": "insufficient"}

    mean_x = sum(x for x, _ in points) / n
    mean_y = sum(y for _, y in points) / n
    denominator = sum((x - mean_x) ** 2 for x, _ in points)
    if denominator < 1e-9:
        return {"slope": None, "n_points": n, "direction": "insufficient"}

    slope = sum((x - mean_x) * (y - mean_y) for x, y in points) / denominator

    # Сдвиг подогнанной прямой от первой до последней точки ряда.
    span = points[-1][0] - points[0][0]
    total_change = slope * span

    if total_change > MIN_TREND_TOTAL_CHANGE:
        direction = "worsening"
    elif total_change < -MIN_TREND_TOTAL_CHANGE:
        direction = "improving"
    else:
        direction = "stable"

    return {
        "slope": float(slope),
        "total_change": float(total_change),
        "n_points": n,
        "direction": direction,
        "first": float(points[0][1]),
        "last": float(points[-1][1]),
    }


def _report_eligibility(db, user_id: int, now: datetime) -> dict:
    """Считает записи в ТОМ ЖЕ окне, которое использует /report/data.

    Раньше допуск к отчёту считался за всё время, а сам отчёт брал последние
    8 недель — можно было открыть отчёт с пустым окном.

    Речь считается по режимам и только по текущей схеме признаков: записи
    прежней схемы в личную норму не входят (см. _attach_baseline), поэтому
    лонгитюдную часть отчёта из них не собрать, и допускать по ним к отчёту
    нельзя — иначе достаточно старых записей, чтобы открыть отчёт, в котором
    нет ни одного отклонения от нормы.
    """
    window_start = now - timedelta(days=REPORT_WINDOW_DAYS)

    mbi_count = db.query(MBIResult)\
        .filter(MBIResult.user_id == user_id, MBIResult.created_at >= window_start)\
        .count()

    def _mode_count(analysis_type: str) -> int:
        return db.query(SpeechAnalysis)\
            .filter(
                SpeechAnalysis.user_id == user_id,
                SpeechAnalysis.created_at >= window_start,
                SpeechAnalysis.analysis_type == analysis_type,
                SpeechAnalysis.feature_schema == FEATURE_SCHEMA_VERSION,
            )\
            .count()

    interview_count = _mode_count("interview")
    reading_count = _mode_count("reading")

    can_generate = (
        mbi_count >= REQUIRED_MBI_COUNT
        and interview_count >= REQUIRED_SPEECH_PER_MODE
        and reading_count >= REQUIRED_SPEECH_PER_MODE
    )
    return {
        "mbi": mbi_count,
        "interview": interview_count,
        "reading": reading_count,
        "can_generate": can_generate,
    }


@app.get("/interview/questions")
async def get_interview_questions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    
    first_mbi = db.query(MBIResult).filter(MBIResult.user_id == current_user.id).order_by(MBIResult.created_at.asc()).first()
    first_speech = db.query(SpeechAnalysis).filter(SpeechAnalysis.user_id == current_user.id).order_by(SpeechAnalysis.created_at.asc()).first()
    
    first_date = None
    if first_mbi and first_speech:
        first_date = min(first_mbi.created_at, first_speech.created_at)
    elif first_mbi:
        first_date = first_mbi.created_at
    elif first_speech:
        first_date = first_speech.created_at
        
    if first_date:
        if first_date.tzinfo is None:
            first_date = first_date.replace(tzinfo=timezone.utc)
        days_since_first = (now - first_date).days
        week_num = (days_since_first // 7) + 1
    else:
        week_num = 1
        
    return get_questions_for_week(week_num)


@app.get("/schedule", response_model=ScheduleResponse)
async def get_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)

    mbi_results = db.query(MBIResult)\
        .filter(MBIResult.user_id == current_user.id)\
        .order_by(MBIResult.created_at.asc())\
        .all()

    mbi_count = len(mbi_results)
    first_mbi = mbi_results[0] if mbi_count > 0 else None
    last_mbi = mbi_results[-1] if mbi_count > 0 else None

    speech_results = db.query(SpeechAnalysis)\
        .filter(SpeechAnalysis.user_id == current_user.id)\
        .order_by(SpeechAnalysis.created_at.desc())\
        .all()

    speech_count = len(speech_results)
    last_speech = speech_results[0] if speech_count > 0 else None

    mbi_due = False
    mbi_days_remaining = 0
    mbi_next = now.strftime("%Y-%m-%d")
    mbi_last_date = last_mbi.created_at if last_mbi else None

    if mbi_count == 0:
        mbi_due = True
        mbi_days_remaining = 0
        mbi_next = now.strftime("%Y-%m-%d")
    elif mbi_count == 1:
        mbi_first_date = first_mbi.created_at.replace(tzinfo=timezone.utc) if first_mbi.created_at.tzinfo is None else first_mbi.created_at
        days_since_start = (now - mbi_first_date).days
        mbi_days_remaining = max(0, MBI_CYCLE_DAYS - days_since_start)
        mbi_due = days_since_start >= MBI_CYCLE_DAYS
        mbi_next = (mbi_first_date + timedelta(days=MBI_CYCLE_DAYS)).strftime("%Y-%m-%d")
    else:
        mbi_due = False
        mbi_days_remaining = 0
        mbi_next = "Finished"

    if last_speech and last_speech.created_at:
        speech_last = last_speech.created_at.replace(tzinfo=timezone.utc) if last_speech.created_at.tzinfo is None else last_speech.created_at
        speech_days_since = (now - speech_last).days
        speech_days_remaining = max(0, SPEECH_CYCLE_DAYS - speech_days_since)
        speech_due = speech_days_since >= SPEECH_CYCLE_DAYS
        speech_next = (speech_last + timedelta(days=SPEECH_CYCLE_DAYS)).strftime("%Y-%m-%d")
        speech_last_date = last_speech.created_at
    else:
        speech_due = True
        speech_days_remaining = 0
        speech_next = now.strftime("%Y-%m-%d")
        speech_last_date = None

    # Счётчики для панели прогресса берутся из того же расчёта, что и допуск:
    # иначе на дашборде можно было увидеть выполненный план при заблокированной
    # кнопке (счётчики считались за всё время и по всем схемам признаков).
    eligibility = _report_eligibility(db, current_user.id, now)
    interview_count = eligibility["interview"]
    reading_count = eligibility["reading"]
    can_generate_report = eligibility["can_generate"]

    today_task = None
    if mbi_due:
        today_task = "mbi"
    elif speech_due:
        today_task = "speech"

    return ScheduleResponse(
        mbi_due=mbi_due,
        speech_due=speech_due,
        mbi_last_date=mbi_last_date,
        speech_last_date=speech_last_date,
        mbi_next_date=mbi_next,
        speech_next_date=speech_next,
        mbi_days_remaining=mbi_days_remaining,
        speech_days_remaining=speech_days_remaining,
        mbi_count=mbi_count,
        speech_count=speech_count,
        interview_count=interview_count,
        reading_count=reading_count,
        required_mbi_count=REQUIRED_MBI_COUNT,
        required_speech_per_mode=REQUIRED_SPEECH_PER_MODE,
        can_generate_report=can_generate_report,
        today_task=today_task
    )


@app.get("/history/speech/{analysis_id}", response_model=SpeechAnalysisResponse)
async def get_speech_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    analysis = db.query(SpeechAnalysis)\
        .filter(SpeechAnalysis.id == analysis_id, SpeechAnalysis.user_id == current_user.id)\
        .first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
        
    return analysis


@app.get("/history", response_model=HistoryResponse)
async def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    speech_analyses = db.query(SpeechAnalysis)\
        .filter(SpeechAnalysis.user_id == current_user.id)\
        .order_by(SpeechAnalysis.created_at.desc())\
        .all()
        
    mbi_results = db.query(MBIResult)\
        .filter(MBIResult.user_id == current_user.id)\
        .order_by(MBIResult.created_at.desc())\
        .all()

    return {
        "speech_analyses": speech_analyses,
        "mbi_results": mbi_results
    }


@app.get("/report/data", response_model=ReportResponse)
async def get_report_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=REPORT_WINDOW_DAYS)

    speech_analyses = db.query(SpeechAnalysis)\
        .filter(SpeechAnalysis.user_id == current_user.id, SpeechAnalysis.created_at >= window_start)\
        .order_by(SpeechAnalysis.created_at.asc())\
        .all()

    mbi_results = db.query(MBIResult)\
        .filter(MBIResult.user_id == current_user.id, MBIResult.created_at >= window_start)\
        .order_by(MBIResult.created_at.asc())\
        .all()


    # Group by week, anchored on the user's ACTUAL data range (first → last
    # session), not on the start of the window. Otherwise, when all sessions
    # are collected within a short period, everything piles into the final week
    # and the earlier weeks are empty — making the time-series charts look
    # broken (a single point glued to the right edge, no line drawn).
    report_data = []
    cross_val_failed = False

    all_dates = (
        [_as_utc(s.created_at) for s in speech_analyses]
        + [_as_utc(m.created_at) for m in mbi_results]
    )

    if all_dates:
        first_date = min(all_dates)
        last_date = max(all_dates)
        # Number of weekly buckets needed to fully cover [first_date, last_date].
        # We need base + num_weeks*7d to be STRICTLY past last_date (buckets use
        # a half-open [start, end) test), so (span // 7) + 1 weeks. No upper cap:
        # the span is already bounded by the REPORT_WINDOW_DAYS query window, and
        # a fixed cap would drop a session sitting exactly on the last boundary.
        span_days = (last_date - first_date).days
        num_weeks = max(1, (span_days // 7) + 1)
        base = first_date
    else:
        num_weeks = 0
        base = window_start

    # We'll calculate weekly averages for the metrics
    for w in range(num_weeks):
        week_start = base + timedelta(weeks=w)
        week_end = week_start + timedelta(weeks=1)
        
        week_speech = [s for s in speech_analyses if week_start <= (s.created_at.replace(tzinfo=timezone.utc) if s.created_at.tzinfo is None else s.created_at) < week_end]
        week_mbi = [m for m in mbi_results if week_start <= (m.created_at.replace(tzinfo=timezone.utc) if m.created_at.tzinfo is None else m.created_at) < week_end]
        
        week_interviews = [s for s in week_speech if s.analysis_type == "interview"]
        week_readings = [s for s in week_speech if s.analysis_type == "reading"]

        # Интервью и чтение НЕ сводятся в одно среднее: условия съёма разные
        # (в чтении текст задан заранее и лингвистического потока нет вовсе),
        # поэтому общий speech_score смешивал два несопоставимых измерения.
        # Он оставлен только как сводка активности, а динамику дают отдельные
        # ряды по режимам.
        dp = {
            "week_start": week_start,
            "week_end": week_end,
            "week_number": w + 1,
            "mbi_score": _mean([m.burnout_index for m in week_mbi]),
            "speech_score": _mean([s.score for s in week_speech]),
            "interview_score": _mean([s.score for s in week_interviews]),
            "reading_score": _mean([s.score for s in week_readings]),
            # Лонгитюдный сигнал: отклонение от личной нормы (analysis.py).
            # В отличие от score он сопоставим во времени для одного человека.
            "interview_deviation": _mean(_active_deviations(week_interviews)),
            "reading_deviation": _mean(_active_deviations(week_readings)),
            # Лингвистика есть только у интервью — у чтения нет транскрипта.
            "absolutist_index": _mean(_text_values(week_interviews, "absolutist_index")),
            "negative_word_ratio": _mean(_text_values(week_interviews, "negative_word_ratio")),
            "sentiment_polarity": _mean(_text_values(week_interviews, "sentiment_polarity")),
            "speech_count": len(week_speech),
            "interview_count": len(week_interviews),
            "reading_count": len(week_readings),
            "mbi_count": len(week_mbi),
        }

        report_data.append(dp)

    interviews = [s for s in speech_analyses if s.analysis_type == "interview"]
    readings = [s for s in speech_analyses if s.analysis_type == "reading"]

    # Средние считаются по самим сессиям, а не по недельным средним: недели
    # содержат разное число записей, и среднее из средних даёт им равный вес.
    avg_interview = _mean([s.score for s in interviews])
    avg_mbi = _mean([m.burnout_index for m in mbi_results])
    avg_abs = _mean(_text_values(interviews, "absolutist_index"))
    avg_neg = _mean(_text_values(interviews, "negative_word_ratio"))
    avg_sent = _mean(_text_values(interviews, "sentiment_polarity"))

    trends = {
        "interview_deviation": _linear_trend(
            [(d["week_number"], d["interview_deviation"]) for d in report_data]),
        "reading_deviation": _linear_trend(
            [(d["week_number"], d["reading_deviation"]) for d in report_data]),
        "interview_score": _linear_trend(
            [(d["week_number"], d["interview_score"]) for d in report_data]),
        "reading_score": _linear_trend(
            [(d["week_number"], d["reading_score"]) for d in report_data]),
        "mbi_score": _linear_trend(
            [(d["week_number"], d["mbi_score"]) for d in report_data]),
    }

    baseline = {
        name: _baseline_summary(items)
        for name, items in (("interview", interviews), ("reading", readings))
    }

    # Правило «семантика не подтверждает акустический риск». Считается только
    # по интервью: акустика и лингвистика тогда снимаются с ОДНИХ записей, и
    # сравнение осмысленно. Пороги эвристические и на реальных данных не
    # калибровались — это предупреждение для человека, а не вывод модели.
    cross_validation_message = None
    semantics_constructive = (
        avg_abs is not None and avg_abs < CROSS_VAL_ABSOLUTIST_MAX
        and avg_neg is not None and avg_neg < CROSS_VAL_NEGATIVE_MAX
        and avg_sent is not None and avg_sent > 0.0
    )

    if semantics_constructive:
        acoustic_flags = avg_interview is not None and avg_interview > CROSS_VAL_RISK_MIN
        mbi_flags = avg_mbi is not None and avg_mbi > CROSS_VAL_RISK_MIN
        if acoustic_flags or mbi_flags:
            cross_val_failed = True
            cross_validation_message = (
                "Risk of burnout is not confirmed by cross-data. "
                "The semantic content remains constructive."
            )

    return ReportResponse(
        data=report_data,
        trends=trends,
        baseline=baseline,
        window_days=REPORT_WINDOW_DAYS,
        cross_validation_failed=cross_val_failed,
        cross_validation_message=cross_validation_message
    )


@app.get("/report/pdf")
async def generate_pdf_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    eligibility = _report_eligibility(db, current_user.id, now)

    if not eligibility["can_generate"]:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Requirements not met: {REQUIRED_MBI_COUNT} MBI questionnaires "
                f"and {REQUIRED_SPEECH_PER_MODE} recordings in EACH speech mode "
                f"required within the last {REPORT_WINDOW_DAYS} days "
                f"(have {eligibility['mbi']} MBI, "
                f"{eligibility['interview']} interview, "
                f"{eligibility['reading']} reading)."
            ),
        )

    speech_analyses = db.query(SpeechAnalysis)\
        .filter(SpeechAnalysis.user_id == current_user.id)\
        .order_by(SpeechAnalysis.created_at.asc())\
        .all()

    mbi_results = db.query(MBIResult)\
        .filter(MBIResult.user_id == current_user.id)\
        .order_by(MBIResult.created_at.asc())\
        .all()

    pdf = FPDF()
    pdf.add_page()

    font_name = "Cyrillic"
    font_added = False

    arial_reg = "C:\\Windows\\Fonts\\arial.ttf"
    arial_bold = "C:\\Windows\\Fonts\\arialbd.ttf"
    arial_ital = "C:\\Windows\\Fonts\\ariali.ttf"

    if os.path.exists(arial_reg):
        try:
            pdf.add_font(font_name, "", arial_reg)
            if os.path.exists(arial_bold):
                pdf.add_font(font_name, "B", arial_bold)
            else:
                pdf.add_font(font_name, "B", arial_reg)
            if os.path.exists(arial_ital):
                pdf.add_font(font_name, "I", arial_ital)
            else:
                pdf.add_font(font_name, "I", arial_reg)
            pdf.set_font(font_name, size=12)
            font_added = True
        except Exception as e:
            print(f"Error adding Arial font: {e}")

    if not font_added:
        # Linux fallback
        dejavu_reg = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        dejavu_bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        dejavu_ital = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"
        if os.path.exists(dejavu_reg):
            try:
                pdf.add_font(font_name, "", dejavu_reg)
                if os.path.exists(dejavu_bold):
                    pdf.add_font(font_name, "B", dejavu_bold)
                else:
                    pdf.add_font(font_name, "B", dejavu_reg)
                    
                if os.path.exists(dejavu_ital):
                    pdf.add_font(font_name, "I", dejavu_ital)
                else:
                    pdf.add_font(font_name, "I", dejavu_reg)
                    
                pdf.set_font(font_name, size=12)
                font_added = True
            except:
                pass

    if not font_added:
        pdf.set_font("Helvetica", size=12)
        font_name = "Helvetica"

    from fpdf.enums import XPos, YPos

    pdf.set_font(font_name, "B", 16)
    pdf.cell(0, 10, "Burnout Assessment Report", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    pdf.ln(10)

    pdf.set_font(font_name, "B", 12)
    pdf.cell(0, 10, f"Employee: {current_user.username}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font(font_name, "", 12)
    pdf.cell(0, 10, f"Email: {current_user.email}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 10, f"Report Date: {datetime.now().strftime('%Y-%m-%d')}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(10)

    pdf.set_font(font_name, "B", 14)
    pdf.cell(0, 10, "Assessment Summary", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font(font_name, "", 12)
    pdf.cell(0, 10, f"- Total MBI Questionnaires: {len(mbi_results)}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 10, f"- Total Speech Analyses: {len(speech_analyses)}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(5)

    pdf.set_font(font_name, "B", 14)
    pdf.cell(0, 10, "MBI Questionnaire Results", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font(font_name, "B", 10)
    pdf.cell(40, 10, "Date", border=1)
    pdf.cell(40, 10, "EE Score", border=1)
    pdf.cell(40, 10, "DP Score", border=1)
    pdf.cell(40, 10, "PA Score", border=1)
    pdf.cell(30, 10, "Index", border=1)
    pdf.ln()
    
    pdf.set_font(font_name, "", 10)
    for res in mbi_results:
        pdf.cell(40, 10, res.created_at.strftime('%Y-%m-%d'), border=1)
        pdf.cell(40, 10, str(res.emotional_exhaustion), border=1)
        pdf.cell(40, 10, str(res.depersonalization), border=1)
        pdf.cell(40, 10, str(res.personal_accomplishment), border=1)
        pdf.cell(30, 10, f"{res.burnout_index:.2f}", border=1)
        pdf.ln()
    pdf.ln(10)

    pdf.set_font(font_name, "B", 14)
    pdf.cell(0, 10, "Speech Analysis History", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    if speech_analyses:
        avg_score = sum(s.score for s in speech_analyses) / len(speech_analyses)
        pdf.set_font(font_name, "", 12)
        pdf.cell(0, 10, f"Average Burnout Risk Score (Acoustics/NLP): {avg_score:.2f}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.ln(20)
    pdf.set_font(font_name, "I", 10)
    pdf.multi_cell(0, 10, "Disclaimer: This report is generated by an AI-based burnout prediction system. It should be used for informational purposes only and does not replace professional medical or psychological advice.")

    # fpdf2.output() returns bytes by default if no filename is provided
    pdf_output = pdf.output()
    buffer = io.BytesIO(pdf_output)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Burnout_Report_{current_user.username}.pdf"}
    )


if __name__ == "__main__":
    import uvicorn
    print("Starting Burnout Predictor API — Multimodal Late Fusion")
    print("Access at: http://localhost:8000")
    print("Docs at: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
