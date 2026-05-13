from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    gender: str
    phone_number: str
    age: int


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    gender: str
    phone_number: str
    age: int
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    gender: Optional[str] = None
    phone_number: Optional[str] = None
    age: Optional[int] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MBISubmit(BaseModel):
    answers: dict[str, int]


class MBIResponse(BaseModel):
    id: int
    user_id: int
    gender: str
    answers: dict[str, int]
    emotional_exhaustion: int
    depersonalization: int
    personal_accomplishment: int
    reduction_of_achievements: int
    burnout_index: float
    created_at: datetime

    model_config = {"from_attributes": True}


class SpeechAnalysisResponse(BaseModel):
    id: int
    user_id: int
    fatigue_level: Optional[int] = None
    stress_events: Optional[bool] = None
    week_number: Optional[int] = None
    filename: str
    file_size_bytes: int
    transcript: str
    label: str
    score: float
    confidence: float
    probabilities: dict[str, float]
    stream_contributions: dict[str, float]
    emotions: dict[str, float]
    dominant_emotion: str
    text_analysis: dict[str, float | int]
    acoustic_features: dict[str, float]
    created_at: datetime

    model_config = {"from_attributes": True}


class HistoryResponse(BaseModel):
    speech_analyses: list[SpeechAnalysisResponse]
    mbi_results: list[MBIResponse]


class ScheduleResponse(BaseModel):
    mbi_due: bool
    speech_due: bool
    mbi_last_date: Optional[datetime] = None
    speech_last_date: Optional[datetime] = None
    mbi_next_date: str
    speech_next_date: str
    mbi_days_remaining: int
    speech_days_remaining: int
    today_task: Optional[str] = None  # "mbi", "speech", or null


class ReportDataPoint(BaseModel):
    week_start: datetime
    week_end: datetime
    week_number: int
    mbi_score: Optional[float] = None
    speech_score: Optional[float] = None
    absolutist_index: Optional[float] = None
    negative_word_ratio: Optional[float] = None
    sentiment_polarity: Optional[float] = None
    speech_count: int = 0
    mbi_count: int = 0

class ReportResponse(BaseModel):
    data: list[ReportDataPoint]
    cross_validation_failed: bool
    cross_validation_message: Optional[str] = None
