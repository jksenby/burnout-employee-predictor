from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import traceback

from wavlm import extract_embedding
from model import predict

app = FastAPI(title="Burnout Predictor API")

origins = ["http://localhost:3000", "http://127.0.0.1:3000",]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.post("/predict")
async def predict_burnout(file: UploadFile):
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file uploaded")
        
        audio_bytes = await file.read()

        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file")

        embedding = extract_embedding(audio_bytes)
        result = predict(embedding)

        result["filename"] = file.filename
        result["file_size_bytes"] = len(audio_bytes)

        return result
    
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("Starting Burnout Predictor API...")
    print("Access at: http://localhost:8000")
    print("Docs at: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
