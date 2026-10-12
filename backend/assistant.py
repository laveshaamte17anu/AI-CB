from typing import List, Dict, Optional, Tuple, Any
from backend.ollama_client import generate_response, generate_response_stream
import backend.database as db
from backend.document_parser import extract_keywords
import logging

logger = logging.getLogger(__name__)

def retrieve_grounding_context(query: str, conversation_id: Optional[str] = None) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Retrieves relevant document excerpts if documents are attached to the conversation or generally.
    Returns (context_string, sources_list).
    """
    keywords = extract_keywords(query)
    if not keywords:
        return "", []
        
    chunks = db.search_document_chunks(keywords, conversation_id=conversation_id, limit=4)
    if not chunks:
        # Also try searching across all documents if none attached specifically
        chunks = db.search_document_chunks(keywords, conversation_id=None, limit=3)
        
    if not chunks:
        return "", []

    context_parts = []
    sources = []
    for ch in chunks:
        filename = ch.get("filename", "Document")
        page = ch.get("page_number", 1)
        content = ch.get("content", "").strip()
        context_parts.append(f"[Source: {filename}, Page {page}]:\n{content}")
        sources.append({
            "filename": filename,
            "page": page,
            "snippet": content[:120] + "..." if len(content) > 120 else content
        })

    return "\n\n".join(context_parts), sources

def process_chat(
    user_message: str,
    conversation_id: Optional[str] = None,
    client_history: Optional[List[Dict[str, str]]] = None,
    mode: str = "chat",
    model_name: Optional[str] = None
) -> Tuple[str, str, List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Processes chat, saves to SQLite, retrieves context, and returns (response, conversation_id, messages, sources).
    """
    if not user_message or not user_message.strip():
        raise ValueError("Message content cannot be empty.")

    clean_message = user_message.strip()

    # Ensure conversation exists
    if not conversation_id:
        conv = db.create_conversation(title=clean_message[:30] + ("..." if len(clean_message) > 30 else ""), mode=mode)
        conversation_id = conv["id"]
    else:
        conv = db.get_conversation(conversation_id)
        if not conv:
            conv = db.create_conversation(title=clean_message[:30], mode=mode)
            conversation_id = conv["id"]
        elif conv["title"] == "New Conversation" or conv["title"] == "New Chat":
            db.rename_conversation(conversation_id, clean_message[:35])

    # Fetch existing conversation history from SQLite
    history_records = db.get_messages(conversation_id, limit=20)
    history = [{"role": m["role"], "content": m["content"]} for m in history_records]

    # Save user message
    db.add_message(conversation_id, "user", clean_message)

    # Document grounding if in doc mode or query has document relevance
    doc_context = ""
    sources = []
    if mode == "doc" or True: # Check if documents exist in DB
        doc_context, sources = retrieve_grounding_context(clean_message, conversation_id=conversation_id)

    # Call local AI
    reply = generate_response(
        prompt=clean_message,
        history=history,
        model_name=model_name,
        mode=mode,
        doc_context=doc_context if doc_context else None
    )

    # Save assistant message with metadata
    meta = {"sources": sources} if sources else None
    db.add_message(conversation_id, "assistant", reply, metadata=meta)

    updated_messages = db.get_messages(conversation_id, limit=50)
    return reply, conversation_id, updated_messages, sources

def clear_conversation(conversation_id: Optional[str] = None):
    if conversation_id:
        db.delete_conversation(conversation_id)
