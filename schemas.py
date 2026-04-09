from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MBISubmit(BaseModel):
    gender: str
    answers: dict[str, int]


class MBIResponse(BaseModel):
    id: int
    user_id: int
    gender: str
    answers: dict[str, int]
    created_at: datetime

    model_config = {"from_attributes": True}


class SpeechAnalysisResponse(BaseModel):
    id: int
    user_id: int
    filename: str
    file_size_bytes: int
    transcript: str
    label: str
    score: float
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
