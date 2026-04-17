from sqlalchemy import Column, Integer, String, DateTime, Float, JSON, ForeignKey
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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    speech_analyses = relationship("SpeechAnalysis", back_populates="user")
    mbi_results = relationship("MBIResult", back_populates="user")


class SpeechAnalysis(Base):
    __tablename__ = "speech_analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
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
    text_analysis = Column(JSON)
    acoustic_features = Column(JSON)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="speech_analyses")


class MBIResult(Base):
    __tablename__ = "mbi_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    gender = Column(String)
    answers = Column(JSON)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="mbi_results")
