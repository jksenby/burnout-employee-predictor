from sqlalchemy import Column, Integer, String, DateTime, Float, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    gender = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    profession = Column(String, nullable=True)
    workplace = Column(String, nullable=True)
    work_experience = Column(Integer, nullable=True)
    education_level = Column(String, nullable=True)
    education_place = Column(String, nullable=True)
    specialty = Column(String, nullable=True)
    city = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    speech_analyses = relationship("SpeechAnalysis", back_populates="user")
    mbi_results = relationship("MBIResult", back_populates="user")


class SpeechAnalysis(Base):
    __tablename__ = "speech_analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    fatigue_level = Column(Integer, nullable=True)
    stress_events = Column(Boolean, nullable=True)
    week_number = Column(Integer, nullable=True)
    analysis_type = Column(String, nullable=True)
    filename = Column(String)
    file_size_bytes = Column(Integer)
    transcript = Column(String)
    label = Column(String)
    score = Column(Float)
    confidence = Column(Float)
    probabilities = Column(JSON)
    stream_contributions = Column(JSON)
    emotions = Column(JSON)
    dominant_emotion = Column(String)
    model_type = Column(String, nullable=True)
    text_analysis = Column(JSON)
    acoustic_features = Column(JSON)
    # Версия способа расчёта акустических признаков (feature_extraction.
    # FEATURE_SCHEMA_VERSION). NULL — запись до версионирования. Личная норма
    # строится только по записям одной версии: v1 считала jitter/shimmer/HNR и
    # темп речи другими формулами, и величины лежат в других шкалах.
    feature_schema = Column(Integer, nullable=True)

    # Лонгитюдный сигнал: отклонение этой записи от личной нормы того же
    # пользователя в том же режиме (см. analysis.py). Независим от score —
    # score абсолютный и межличностно несопоставимый, эти поля относительные.
    baseline_status = Column(String, nullable=True)      # calibrating|active|unavailable
    baseline_deviation = Column(Float, nullable=True)    # [-1, 1], + = хуже нормы
    baseline_deltas = Column(JSON, nullable=True)        # относительные сдвиги по признакам
    baseline_n = Column(Integer, nullable=True)          # сессий в калибровочном окне
    baseline_warning = Column(Boolean, nullable=True)    # маркер монотонности + дрожания

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="speech_analyses")


class MBIResult(Base):
    __tablename__ = "mbi_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    gender = Column(String)
    answers = Column(JSON)
    emotional_exhaustion = Column(Integer)
    depersonalization = Column(Integer)
    personal_accomplishment = Column(Integer)
    reduction_of_achievements = Column(Integer)
    burnout_index = Column(Float)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="mbi_results")
