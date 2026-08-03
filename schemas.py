from pydantic import BaseModel, EmailStr, field_validator
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
    profession: Optional[str] = None
    workplace: Optional[str] = None
    work_experience: Optional[int] = None
    education_level: Optional[str] = None
    education_place: Optional[str] = None
    specialty: Optional[str] = None
    city: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    gender: Optional[str] = None
    phone_number: Optional[str] = None
    age: Optional[int] = None
    profession: Optional[str] = None
    workplace: Optional[str] = None
    work_experience: Optional[int] = None
    education_level: Optional[str] = None
    education_place: Optional[str] = None
    specialty: Optional[str] = None
    city: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# MBI-HSS: 22 утверждения, шкала частоты 0..4 (см. mbi.scale_options в i18n.js).
MBI_QUESTION_COUNT = 22
MBI_ANSWER_MIN = 0
MBI_ANSWER_MAX = 4


class MBISubmit(BaseModel):
    answers: dict[str, int]

    @field_validator("answers")
    @classmethod
    def _require_complete_questionnaire(cls, value: dict[str, int]) -> dict[str, int]:
        """Опросник принимается только целиком.

        Раньше подсчёт шёл через answers.get(f"q{i}", 0), и пустой словарь давал
        EE=0, DP=0, PA=0 → редукция достижений 32 из 32 → SBSI = 0.577, то есть
        «умеренное выгорание» из ничего. Хуже того, пропуски искажали шкалы в
        РАЗНЫЕ стороны: EE и DP занижались (выглядит здоровее), а редукция
        достижений завышалась (выглядит хуже).
        """
        expected = {f"q{i}" for i in range(MBI_QUESTION_COUNT)}

        missing = sorted(expected - value.keys(), key=lambda k: int(k[1:]))
        if missing:
            raise ValueError(
                f"Опросник заполнен не полностью: нет ответов на {len(missing)} "
                f"из {MBI_QUESTION_COUNT} вопросов ({', '.join(missing[:5])}"
                f"{'...' if len(missing) > 5 else ''})."
            )

        unexpected = sorted(value.keys() - expected)
        if unexpected:
            raise ValueError(
                f"Неизвестные ключи ответов: {', '.join(unexpected[:5])}. "
                f"Ожидаются q0..q{MBI_QUESTION_COUNT - 1}."
            )

        out_of_range = {
            k: v for k, v in value.items()
            if not MBI_ANSWER_MIN <= v <= MBI_ANSWER_MAX
        }
        if out_of_range:
            raise ValueError(
                f"Ответы должны быть в диапазоне {MBI_ANSWER_MIN}..{MBI_ANSWER_MAX}. "
                f"Некорректно: {dict(list(out_of_range.items())[:5])}."
            )

        return value


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
    analysis_type: Optional[str] = None
    filename: str
    file_size_bytes: int
    transcript: Optional[str] = None
    label: str
    score: float
    confidence: float
    probabilities: dict[str, float]
    stream_contributions: dict[str, float]
    emotions: dict[str, float]
    dominant_emotion: str
    text_analysis: Optional[dict[str, float | int]] = None
    acoustic_features: dict[str, float]
    model_type: Optional[str] = None
    feature_schema: Optional[int] = None
    # Лонгитюдный сигнал относительно личной нормы (analysis.py). Отсутствует,
    # пока норма не набрана — старые записи тоже приходят с null.
    baseline_status: Optional[str] = None
    baseline_deviation: Optional[float] = None
    baseline_deltas: Optional[dict[str, float]] = None
    baseline_n: Optional[int] = None
    baseline_warning: Optional[bool] = None
    created_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}


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
    mbi_count: int
    speech_count: int
    # Записи текущей схемы признаков в окне отчёта, по режимам, — ровно то, что
    # считает допуск к отчёту (см. _report_eligibility).
    interview_count: int = 0
    reading_count: int = 0
    # Требования допуска отдаются вместе со счётчиками, чтобы интерфейс не
    # держал их дубликатом в переводах: раньше в i18n было зашито «8 анализов
    # речи», и после смены правила текст разошёлся бы с поведением кнопки.
    required_mbi_count: int
    required_speech_per_mode: int
    can_generate_report: bool
    today_task: Optional[str] = None  # "mbi", "speech", or null


class ReportDataPoint(BaseModel):
    week_start: datetime
    week_end: datetime
    week_number: int
    mbi_score: Optional[float] = None
    # Смешанное среднее по обоим режимам. Оставлено как сводка активности:
    # интервью и чтение снимаются в разных условиях, и для динамики нужно
    # смотреть interview_* / reading_* по отдельности.
    speech_score: Optional[float] = None
    interview_score: Optional[float] = None
    reading_score: Optional[float] = None
    # Отклонение от личной нормы, [-1, 1], + = хуже своей нормы.
    interview_deviation: Optional[float] = None
    reading_deviation: Optional[float] = None
    absolutist_index: Optional[float] = None
    negative_word_ratio: Optional[float] = None
    sentiment_polarity: Optional[float] = None
    speech_count: int = 0
    interview_count: int = 0
    reading_count: int = 0
    mbi_count: int = 0


class TrendInfo(BaseModel):
    """МНК-наклон ряда на неделю. direction = insufficient, если точек < 3.

    Направление определяется по total_change — сдвигу подогнанной прямой за всё
    окно наблюдения, а не по наклону: иначе ряд шумовых значений внутри личной
    нормы получал ярлык тренда.
    """
    slope: Optional[float] = None
    total_change: Optional[float] = None
    n_points: int = 0
    direction: str = "insufficient"
    first: Optional[float] = None
    last: Optional[float] = None


class BaselineSummary(BaseModel):
    status: str  # no_data | calibrating | active
    sessions: int = 0
    # Записи прежней схемы признаков — в норму не входят, показываются, чтобы
    # было видно, почему калибровка началась заново.
    legacy_sessions: int = 0
    active_sessions: int = 0
    sessions_until_ready: int = 0
    latest_deviation: Optional[float] = None
    mean_deviation: Optional[float] = None
    warning_sessions: int = 0


class ReportResponse(BaseModel):
    data: list[ReportDataPoint]
    trends: dict[str, TrendInfo] = {}
    baseline: dict[str, BaselineSummary] = {}
    window_days: int = 0
    cross_validation_failed: bool
    cross_validation_message: Optional[str] = None
