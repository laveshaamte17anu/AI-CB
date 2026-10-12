import os
import sys
from pathlib import Path

# Ensure project root is in sys.path so 'from backend...' always resolves
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import shutil
import tempfile
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional

from backend.config import DEFAULT_MODEL, BACKEND_PORT
from backend.ollama_client import check_ollama_health, check_model_available
from backend.assistant import process_chat, clear_conversation
from backend.conversation import session_conversation
from backend.speech_to_text import transcribe_audio_file
from backend.utils import safe_remove_file, logger

app = FastAPI(
    title="Local AI Voice Assistant API",
    description="Backend API for local Whisper speech-to-text, Ollama Qwen3:4B LLM, and voice assistant orchestration.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = None

class ChatResponse(BaseModel):
    response: str
    history: List[Dict[str, str]]

@app.get("/api/health")
def health_check():
    """Health check endpoint for local services."""
    ollama_ok = check_ollama_health()
    return {
        "status": "ok" if ollama_ok else "degraded",
        "ollama": "running" if ollama_ok else "stopped"
    }

@app.get("/api/model")
def model_status():
    """Status check for local model qwen3:4b availability."""
    ollama_ok = check_ollama_health()
    model_ok = check_model_available(DEFAULT_MODEL) if ollama_ok else False

    return {
        "model": DEFAULT_MODEL,
        "ollama_running": ollama_ok,
        "model_available": model_ok
    }

@app.post("/api/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """Processes chat messages using local Ollama Qwen3:4B."""
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message text cannot be empty.")
        
    try:
        reply = process_chat(
            user_message=request.message,
            client_history=request.history
        )
        return {
            "response": reply,
            "history": session_conversation.get_history()
        }
    except RuntimeError as e:
        logger.error(f"Chat service error: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/transcribe")
async def transcribe_endpoint(file: UploadFile = File(...)):
    """Transcribes uploaded audio file using local faster-whisper on CPU."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No audio file uploaded.")
        
    temp_dir = tempfile.gettempdir()
    extension = os.path.splitext(file.filename)[1] or ".webm"
    temp_path = os.path.join(temp_dir, f"voice_input_{os.urandom(4).hex()}{extension}")
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        transcribed_text = transcribe_audio_file(temp_path)
        return {"text": transcribed_text}
    except Exception as e:
        safe_remove_file(temp_path)
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Could not understand the audio: {str(e)}")

@app.post("/api/clear")
def clear_chat_endpoint():
    """Clears conversation history."""
    clear_conversation()
    return {"status": "cleared", "history": []}

@app.get("/api/history")
def get_history_endpoint():
    """Retrieves current session history."""
    return {"history": session_conversation.get_history()}


if __name__ == "__main__":
    import uvicorn
    app_target = "main:app" if Path.cwd() == Path(__file__).resolve().parent else "backend.main:app"
    uvicorn.run(app_target, host="127.0.0.1", port=BACKEND_PORT, reload=True)
