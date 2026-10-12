from typing import List, Dict, Optional
from backend.ollama_client import generate_response as generate_ollama_response
from backend.conversation import session_conversation

def process_chat(
    user_message: str,
    client_history: Optional[List[Dict[str, str]]] = None
) -> str:
    """
    Processes chat message, updates local history (deduplicating if needed), calls local Ollama (qwen3:4b), and returns response.
    """
    if not user_message or not user_message.strip():
        raise ValueError("Message content cannot be empty.")

    clean_message = user_message.strip()

    if client_history is not None:
        valid_history = [
            m for m in client_history 
            if isinstance(m, dict) and "role" in m and "content" in m
        ]
        # Remove trailing duplicate user message if client already included it
        if valid_history and valid_history[-1].get("role") == "user" and valid_history[-1].get("content", "").strip() == clean_message:
            valid_history = valid_history[:-1]
        session_conversation.set_history(valid_history)

    session_conversation.add_user_message(clean_message)
    current_history = session_conversation.get_history()

    # Call local Ollama Qwen3:4B model
    response_text = generate_ollama_response(prompt=clean_message, history=current_history[:-1])

    session_conversation.add_assistant_message(response_text)
    return response_text

def clear_conversation():
    session_conversation.clear()
