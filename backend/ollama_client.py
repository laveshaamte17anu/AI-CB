import os
import requests
import logging
from typing import List, Dict, Optional
from backend.config import OLLAMA_CHAT_URL, OLLAMA_TAGS_URL, DEFAULT_MODEL, MAX_TOKENS, OLLAMA_TIMEOUT
from backend.utils import clean_thinking_text

logger = logging.getLogger(__name__)

def check_ollama_health() -> bool:
    """Checks if Ollama service is reachable at local endpoint."""
    try:
        res = requests.get(OLLAMA_TAGS_URL, timeout=3)
        return res.status_code == 200
    except Exception:
        return False

def get_installed_models() -> List[str]:
    """Returns list of all model names pulled in Ollama."""
    try:
        res = requests.get(OLLAMA_TAGS_URL, timeout=3)
        if res.status_code == 200:
            models = res.json().get("models", [])
            return [m.get("name", "") for m in models if m.get("name")]
    except Exception as e:
        logger.error(f"Error fetching Ollama models: {e}")
    return []

def select_best_local_model() -> str:
    """
    Selects the fastest local model for immediate CPU responses.
    Prioritizes direct instruction models (qwen2.5:1.5b) over heavy reasoning models (qwen3:4b).
    """
    installed = get_installed_models()
    if not installed:
        return DEFAULT_MODEL
    
    fast_models = ["qwen2.5:1.5b", "qwen2.5:0.5b", "llama3.2:1b", "tinyllama", "qwen3:4b"]
    for pref in fast_models:
        for m in installed:
            if pref in m or m.startswith(pref):
                return m
    return installed[0]

def check_model_available(model_name: str = DEFAULT_MODEL) -> bool:
    """Checks whether requested model or any local model is pulled in Ollama."""
    installed = get_installed_models()
    return len(installed) > 0

def build_chat_messages(prompt: str, history: Optional[List[Dict[str, str]]] = None) -> List[Dict[str, str]]:
    """Builds structured chat messages list for Ollama Chat API."""
    messages = [
        {
            "role": "system",
            "content": "You are a helpful, direct local AI voice assistant. Provide complete, clear, and well-structured answers. Always complete your thoughts and sentences fully without cutting off. Never output internal thought processes or reasoning tags."
        }
    ]

    if history:
        valid_history = [m for m in history if m.get("role") and m.get("content")]
        for msg in valid_history[-4:]:
            role = "user" if msg["role"] == "user" else "assistant"
            messages.append({"role": role, "content": msg["content"]})

    messages.append({"role": "user", "content": prompt})
    return messages

def _call_single_model(model_name: str, messages: List[Dict[str, str]], timeout_sec: int = OLLAMA_TIMEOUT) -> str:
    """Executes call to specific model with fast CPU options and full response token capacity."""
    payload = {
        "model": model_name,
        "messages": messages,
        "stream": False,
        "think": False,
        "options": {
            "num_predict": MAX_TOKENS,
            "num_ctx": 4096,
            "temperature": 0.3,
            "num_thread": max(1, (os.cpu_count() or 4))
        }
    }

    response = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=timeout_sec)
    if response.status_code != 200:
        raise RuntimeError(f"Ollama returned HTTP status {response.status_code}: {response.text}")

    data = response.json()
    message_obj = data.get("message", {})
    raw_text = message_obj.get("content", "")
    cleaned = clean_thinking_text(raw_text)
    return cleaned

def generate_response(prompt: str, history: Optional[List[Dict[str, str]]] = None, model_name: Optional[str] = None) -> str:
    """
    Generates response using fastest available local Ollama model with automatic fallback.
    """
    if not check_ollama_health():
        raise RuntimeError("Ollama is not running. Please start Ollama at http://localhost:11434.")

    messages = build_chat_messages(prompt, history)
    primary_model = model_name or select_best_local_model()
    installed = get_installed_models()

    # Prioritize fast models for fallback
    candidate_models = [primary_model]
    for fast_m in ["qwen2.5:1.5b", "qwen2.5:0.5b", "llama3.2:1b", "qwen3:4b"]:
        if any(fast_m in m for m in installed):
            candidate_models.append(fast_m)

    # De-duplicate preserving order
    candidate_models = list(dict.fromkeys(candidate_models))

    last_error = None
    for target in candidate_models:
        try:
            logger.info(f"Querying local model '{target}'...")
            timeout = min(OLLAMA_TIMEOUT, 45) if ("1.5b" in target or "0.5b" in target) else OLLAMA_TIMEOUT
            answer = _call_single_model(target, messages, timeout_sec=timeout)
            if answer and len(answer.strip()) > 0:
                logger.info(f"Successfully generated response with model '{target}'")
                return answer
        except Exception as e:
            logger.warning(f"Model '{target}' failed or timed out: {e}. Trying fallback...")
            last_error = str(e)
            continue

    raise RuntimeError(f"Could not get response from local AI. Details: {last_error}")
