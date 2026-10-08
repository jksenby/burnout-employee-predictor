# Burnout Employee Predictor

[![CI](https://github.com/jksenby/burnout-employee-predictor/actions/workflows/ci.yml/badge.svg)](https://github.com/jksenby/burnout-employee-predictor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Система раннего выявления профессионального выгорания сотрудников по речи.
Это программный модуль к магистерской диссертации: он объединяет опросник
Маслач (MBI) с мультимодальным анализом голоса (акустика, эмоции, лексика) и
отслеживает, как меняется голос человека относительно его **собственной**
нормы на протяжении нескольких недель.

## Как это работает

```
аудио ─► decode / validate ─► Praat + librosa ─────────────┐   (просодия, jitter, shimmer, HNR, MFCC)
                      │                                    │
                      ├─► HuBERT ──────────────────────────┤
                      ├─► wav2vec2 (эмоции) ───────────────┼─► Gradient Boosting ─► риск: Low / Medium / High
                      ├─► WavLM ───────────────────────────┤
                      └─► Whisper ─► лексические маркеры ──┘
                                   (абсолютизмы, негатив, «я»)

acoustic_features ─► личная норма (первые 3–5 сессий, медиана + MAD) ─► отклонение от нормы
```

Модуль выдаёт два независимых сигнала:

| Сигнал | Модуль | Смысл |
|---|---|---|
| `score`, `label` | [`model.py`](model.py) | Абсолютная оценка одной записи (снимок) |
| `baseline.deviation_score` | [`analysis.py`](analysis.py) | Насколько запись отклоняется от **личной** нормы того же человека, (−1; 1), «+» значит хуже |

Протокол наблюдения: MBI раз в 60 дней, речь раз в неделю в двух режимах
(свободное интервью и чтение текста). Отчёт открывается, когда собрано
2 MBI и по 6 записей в каждом режиме.

## Структура

| Путь | Назначение |
|---|---|
| `main.py` | FastAPI: эндпоинты анализа, MBI, истории и отчётов (PDF) |
| `feature_extraction.py` | Акустические признаки (Praat/parselmouth, librosa) |
| `text_features.py` | Лингвистические маркеры для EN / RU / KZ |
| `analysis.py` | Личная норма и лонгитюдное отклонение |
| `model.py`, `train.py` | Классификатор и его обучение |
| `hubert.py`, `wavlm.py`, `emotion.py`, `speech_transcriber.py` | Нейросетевые потоки |
| `audio_io.py` | Декодирование и проверка качества записи |
| `frontend/` | React-клиент (запись, MBI, история, отчёт) |
| `tests/` | Pytest-тесты |
| `.github/workflows/` | CI/CD |

## Установка и запуск

Нужны Python 3.11+ и Node.js 20+.

```bash
python -m venv .venv
.venv\Scripts\activate          # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python main.py                  # API на http://localhost:8000, документация на /docs
```

```bash
cd frontend
npm ci
npm start                       # http://localhost:3000
```

При первом запуске HuggingFace скачивает веса HuBERT, WavLM, wav2vec2 и
Whisper (несколько ГБ). Если нужен дообученный казахско-русский Whisper,
запустите `python scripts/convert_whisper_model.py`. В продакшене задайте
переменную окружения `SECRET_KEY`.

Переобучить классификатор: `python train.py`. После этого обновятся
`burnout_model.pkl` и `burnout_model.meta.json`.

## Тесты

```bash
pip install -r requirements-ci.txt
pytest --cov
ruff check .
cd frontend && npm test -- --watchAll=false
```

Для `requirements-ci.txt` не нужен PyTorch. Нейросетевые потоки в
[`tests/test_api.py`](tests/test_api.py) заменены заглушками, а всё
остальное проверяется на синтетическом голосовом сигнале по-настоящему:
декодирование, Praat-признаки, обученный классификатор, личная норма, БД и
генерация PDF.

## CI/CD

| Workflow | Триггер | Что делает |
|---|---|---|
| [`ci.yml`](.github/workflows/ci.yml) | push, pull request | ruff → pytest (Python 3.11 и 3.12) с покрытием → Jest и production-сборка фронтенда; отчёты и сборка сохраняются как артефакты |
| [`release.yml`](.github/workflows/release.yml) | тег `v*` | прогоняет CI, затем публикует GitHub Release со сборкой фронтенда, моделью и контрольными суммами |
| [`dependabot.yml`](.github/dependabot.yml) | ежемесячно | PR с обновлениями pip, npm и GitHub Actions |

Как выпустить релиз:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Ограничения

* Классификатор обучен на **синтетических** данных (`train.py`), поэтому его
  абсолютная оценка пока демонстрационная. Методически основной сигнал —
  отклонение от личной нормы, ведь оно ни на чём не обучено.
* Система не ставит диагноз и не заменяет консультацию специалиста.

## Лицензия

[MIT](LICENSE) © 2026 Zhalgas Karsenbay
