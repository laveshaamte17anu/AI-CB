import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import json
import shutil
import tempfile
import uuid
from typing import List, Dict, Optional, Any
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.config import DEFAULT_MODEL, BACKEND_PORT
from backend.ollama_client import (
    check_ollama_health,
    check_model_available,
    get_installed_models,
    select_best_local_model,
    generate_response_stream
)
from backend.assistant import process_chat, retrieve_grounding_context, clear_conversation
import backend.database as db
from backend.document_parser import validate_document, parse_document, chunk_document_pages
from backend.speech_to_text import transcribe_audio_file
from backend.utils import safe_remove_file, logger

app = FastAPI(
    title="Local AI Assistant API",
    description="Production-grade local AI assistant with SQLite persistence, Ollama LLM, Faster-Whisper STT, Document RAG, and Coding Assistant.",
    version="3.0.0"
)

# Enable CORS for local origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://localhost:5173",
        "http://localhost:5174",
        "https://localhost:5174",
        "http://127.0.0.1:5174",
        "https://127.0.0.1:5174",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload storage directory
UPLOADS_DIR = Path(__file__).resolve().parent / "data" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# State for currently active model override
CURRENT_MODEL_OVERRIDE = None

# --- REQUEST / RESPONSE MODELS ---

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    mode: str = "chat" # chat, code, doc
    model: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = None

class CreateConversationRequest(BaseModel):
    title: str = "New Chat"
    mode: str = "chat"

class RenameConversationRequest(BaseModel):
    title: str

class MemoryCreateRequest(BaseModel):
    content: str
    category: str = "fact" # fact, preference, instruction
    key: Optional[str] = None

class MemoryUpdateRequest(BaseModel):
    content: Optional[str] = None
    is_active: Optional[int] = None

class ModelSelectRequest(BaseModel):
    model: str

# --- SYSTEM & HEALTH ENDPOINTS ---

@app.get("/api/health")
def health_check():
    """Health check for backend and local Ollama service."""
    ollama_ok = check_ollama_health()
    return {
        "status": "ok" if ollama_ok else "degraded",
        "ollama": "running" if ollama_ok else "stopped",
        "database": "connected"
    }

@app.get("/api/model")
def model_status():
    """Returns local model status and list of all installed Ollama models."""
    ollama_ok = check_ollama_health()
    installed = get_installed_models() if ollama_ok else []
    active = CURRENT_MODEL_OVERRIDE or select_best_local_model()

    return {
        "model": active,
        "ollama_running": ollama_ok,
        "model_available": len(installed) > 0,
        "installed_models": installed
    }

@app.post("/api/model/select")
def select_model(request: ModelSelectRequest):
    """Sets active model preference."""
    global CURRENT_MODEL_OVERRIDE
    CURRENT_MODEL_OVERRIDE = request.model.strip()
    return {"status": "updated", "model": CURRENT_MODEL_OVERRIDE}

# --- CONVERSATIONS CRUD ---

@app.get("/api/conversations")
def get_conversations(q: Optional[str] = Query(None)):
    """Retrieves all conversations, optionally filtered by search query."""
    return db.list_conversations(search_query=q)

@app.post("/api/conversations")
def create_new_conversation(request: CreateConversationRequest):
    """Creates a new conversation."""
    return db.create_conversation(title=request.title, mode=request.mode)

@app.get("/api/conversations/{conv_id}")
def get_conversation_details(conv_id: str):
    """Retrieves a conversation and its messages."""
    conv = db.get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = db.get_messages(conv_id, limit=200)
    return {
        **conv,
        "messages": messages
    }

@app.patch("/api/conversations/{conv_id}")
def rename_conv(conv_id: str, request: RenameConversationRequest):
    """Renames an existing conversation."""
    success = db.rename_conversation(conv_id, request.title)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "renamed", "id": conv_id, "title": request.title.strip()}

@app.delete("/api/conversations/{conv_id}")
def delete_conv(conv_id: str):
    """Deletes a conversation."""
    success = db.delete_conversation(conv_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted", "id": conv_id}

# --- CHAT & STREAMING ---

@app.post("/api/chat")
def chat_endpoint(request: ChatRequest):
    """Standard non-streaming chat endpoint with full persistence."""
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message text cannot be empty.")

    try:
        chosen_model = request.model or CURRENT_MODEL_OVERRIDE
        reply, conv_id, updated_msgs, sources = process_chat(
            user_message=request.message,
            conversation_id=request.conversation_id,
            client_history=request.history,
            mode=request.mode,
            model_name=chosen_model
        )
        return {
            "response": reply,
            "conversation_id": conv_id,
            "history": updated_msgs,
            "sources": sources
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        logger.error(f"Chat service error: {re}")
        raise HTTPException(status_code=503, detail=str(re))
    except Exception as e:
        logger.error(f"Unexpected chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/chat/stream")
def chat_stream_endpoint(request: ChatRequest):
    """
    Streaming chat endpoint via Server-Sent Events (SSE).
    Sends token-by-token chunks in real time.
    """
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message text cannot be empty.")

    clean_message = request.message.strip()
    conv_id = request.conversation_id

    # Ensure conversation exists
    if not conv_id:
        conv = db.create_conversation(title=clean_message[:35], mode=request.mode)
        conv_id = conv["id"]
    else:
        existing = db.get_conversation(conv_id)
        if not existing:
            conv = db.create_conversation(title=clean_message[:35], mode=request.mode)
            conv_id = conv["id"]
        elif existing["title"] in ("New Conversation", "New Chat"):
            db.rename_conversation(conv_id, clean_message[:35])

    # Save user message to database
    db.add_message(conv_id, "user", clean_message)

    # Get history and grounding context
    history_records = db.get_messages(conv_id, limit=16)
    history = [{"role": m["role"], "content": m["content"]} for m in history_records[:-1]]

    doc_context, sources = retrieve_grounding_context(clean_message, conversation_id=conv_id)
    chosen_model = request.model or CURRENT_MODEL_OVERRIDE

    def event_stream():
        full_response = []
        try:
            # Yield metadata header
            yield f"data: {json.dumps({'event': 'start', 'conversation_id': conv_id, 'sources': sources})}\n\n"

            for chunk in generate_response_stream(
                prompt=clean_message,
                history=history,
                model_name=chosen_model,
                mode=request.mode,
                doc_context=doc_context if doc_context else None
            ):
                full_response.append(chunk)
                yield f"data: {json.dumps({'event': 'chunk', 'text': chunk})}\n\n"

            # Save full generated response to SQLite
            final_text = "".join(full_response).strip()
            meta = {"sources": sources} if sources else None
            db.add_message(conv_id, "assistant", final_text, metadata=meta)

            yield f"data: {json.dumps({'event': 'done', 'conversation_id': conv_id, 'full_text': final_text})}\n\n"
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: {json.dumps({'event': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

# --- MEMORIES CRUD ---

@app.get("/api/memories")
def get_all_memories():
    """Lists saved user memories and preferences."""
    return db.list_memories()

@app.post("/api/memories")
def create_memory(request: MemoryCreateRequest):
    """Creates a new user memory/preference."""
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="Memory content cannot be empty.")
    return db.add_memory(content=request.content, category=request.category, key=request.key)

@app.patch("/api/memories/{mem_id}")
def update_memory_item(mem_id: str, request: MemoryUpdateRequest):
    """Updates memory content or active status."""
    success = db.update_memory(mem_id, content=request.content, is_active=request.is_active)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"status": "updated", "id": mem_id}

@app.delete("/api/memories/{mem_id}")
def delete_memory_item(mem_id: str):
    """Deletes a memory item."""
    success = db.delete_memory(mem_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"status": "deleted", "id": mem_id}

@app.delete("/api/memories")
def clear_all_memories():
    """Clears all saved memories."""
    count = db.clear_memories()
    return {"status": "cleared", "deleted_count": count}

# --- DOCUMENT MANAGEMENT & EXTRACTION ---

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    conversation_id: Optional[str] = Form(None)
):
    """Uploads, validates, parses, chunks, and indexes a PDF/DOCX/TXT document."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    # Read file content safely
    contents = await file.read()
    file_size = len(contents)

    is_valid, err_msg = validate_document(file.filename, file_size)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg)

    # Save to controlled uploads folder
    safe_name = f"{uuid.uuid4().hex[:8]}_{Path(file.filename).name}"
    stored_path = UPLOADS_DIR / safe_name

    with open(stored_path, "wb") as f:
        f.write(contents)

    try:
        pages, page_count, full_text = parse_document(str(stored_path), file.filename)
        chunks = chunk_document_pages(pages)

        # Quick summary preview (first 250 characters)
        summary = full_text[:300].strip() + ("..." if len(full_text) > 300 else "")

        saved_doc = db.save_document(
            filename=file.filename,
            stored_path=str(stored_path),
            file_size=file_size,
            file_type=Path(file.filename).suffix.lower(),
            page_count=page_count,
            conversation_id=conversation_id,
            summary=summary,
            chunks=chunks
        )

        return {
            "status": "success",
            "document": saved_doc,
            "chunks_count": len(chunks),
            "message": f"Successfully parsed {file.filename} ({page_count} pages, {len(chunks)} chunks)."
        }
    except Exception as e:
        safe_remove_file(str(stored_path))
        logger.error(f"Error parsing uploaded document: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

@app.get("/api/documents")
def get_documents(conversation_id: Optional[str] = Query(None)):
    """Lists uploaded documents."""
    return db.list_documents(conversation_id=conversation_id)

@app.delete("/api/documents/{doc_id}")
def delete_doc(doc_id: str):
    """Deletes an uploaded document and its indexed chunks."""
    success = db.delete_document(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "deleted", "id": doc_id}

# --- SPEECH RECOGNITION (WHISPER) ---

@app.post("/api/transcribe")
async def transcribe_endpoint(file: UploadFile = File(...)):
    """Transcribes audio file using faster-whisper on CPU."""
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
        raise HTTPException(status_code=500, detail=f"Could not transcribe audio: {str(e)}")

# --- LEGACY COMPATIBILITY ENDPOINTS ---

@app.post("/api/clear")
def clear_chat_endpoint():
    """Clears conversation history."""
    clear_conversation()
    return {"status": "cleared", "history": []}

@app.get("/api/history")
def get_history_endpoint():
    """Retrieves conversation history."""
    convs = db.list_conversations()
    if convs:
        messages = db.get_messages(convs[0]["id"], limit=50)
    else:
        messages = []
    return {"history": messages}

if __name__ == "__main__":
    import uvicorn
    import socket

    # Check port availability to give clear diagnostics if port is already occupied
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("127.0.0.1", BACKEND_PORT))
        sock.close()
    except OSError:
        logger.error(f"Port {BACKEND_PORT} is already occupied by another process.")
        print(f"\n[DIAGNOSTIC] Port {BACKEND_PORT} is already in use.")
        print(f"[DIAGNOSTIC] If a previous assistant instance is running, close it or set BACKEND_PORT to a different port in .env.\n")
        sys.exit(1)

    app_target = "main:app" if Path.cwd() == Path(__file__).resolve().parent else "backend.main:app"
    uvicorn.run(app_target, host="127.0.0.1", port=BACKEND_PORT, reload=True)
