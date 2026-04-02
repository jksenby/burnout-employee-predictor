from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import traceback

from hubert import extract_hubert_embedding
from wavlm import extract_embedding as extract_wavlm_embedding
from feature_extraction import extract_acoustic_features
from emotion import extract_emotion
from speech_transcriber import transcribe_bytes
from text_features import extract_text_features
from model import predict

from database import engine, Base, get_db
from models_db import User, SpeechAnalysis, MBIResult
from schemas import MBISubmit, MBIResponse, HistoryResponse
from sqlalchemy.orm import Session
from fastapi import Depends
from auth import get_current_user, get_optional_user
from routes.auth import router as auth_router

# Create DB tables
Base.metadata.create_all(bind=engine)

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
            "Whisper (Semantics/Multilingual)"
        ],
        "version": "2.0"
    }


@app.post("/predict")
async def predict_burnout(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user)
):
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file uploaded")

        audio_bytes = await file.read()

        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file")

        print(f"\n{'='*50}")
        print(f"Processing: {file.filename} ({len(audio_bytes)} bytes)")
        print(f"{'='*50}")

        print("\n[Stream 1] HuBERT — acoustic embedding...")
        hubert_embedding = extract_hubert_embedding(audio_bytes)

        print("[Stream 1] SpeechBrain — emotion recognition...")
        emotion_result = extract_emotion(audio_bytes)

        print("\n[Stream 2] WavLM — prosody embedding...")
        wavlm_embedding = extract_wavlm_embedding(audio_bytes)

        print("[Stream 2] Librosa — acoustic features...")
        acoustic_features = extract_acoustic_features(audio_bytes)

        print("\n[Stream 3] Whisper — transcription (multilingual)...")
        transcript = transcribe_bytes(audio_bytes)

        print("[Stream 3] NLP — linguistic features...")
        text_feat = extract_text_features(transcript)

        print("\n[Fusion] Running multimodal late fusion...")
        result = predict(
            hubert_embedding=hubert_embedding,
            wavlm_embedding=wavlm_embedding,
            acoustic_features=acoustic_features,
            emotion_result=emotion_result,
            text_features=text_feat,
        )

        result["filename"] = file.filename
        result["file_size_bytes"] = len(audio_bytes)
        result["transcript"] = transcript
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
        }

        print(f"\n{'='*50}")
        print(f"Result: {result['label']} (score={result['score']:.3f})")
        print(f"{'='*50}\n")

        if current_user:
            db_analysis = SpeechAnalysis(
                user_id=current_user.id,
                filename=result["filename"],
                file_size_bytes=result["file_size_bytes"],
                transcript=result["transcript"],
                label=result["label"],
                score=result["score"],
                acoustic_features=result["acoustic_features"]
            )
            db.add(db_analysis)
            db.commit()
            print(f"[{current_user.username}] Saved analysis to DB.")

        return result

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
        db_mbi = MBIResult(
            user_id=current_user.id,
            gender=payload.gender,
            answers=payload.answers
        )
        db.add(db_mbi)
        db.commit()
        db.refresh(db_mbi)
        return db_mbi
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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


if __name__ == "__main__":
    import uvicorn
    print("Starting Burnout Predictor API — Multimodal Late Fusion")
    print("Access at: http://localhost:8000")
    print("Docs at: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
