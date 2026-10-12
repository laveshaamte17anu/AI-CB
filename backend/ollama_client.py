import os
import json
import requests
import logging
from typing import List, Dict, Optional, Any, Generator
from backend.config import OLLAMA_CHAT_URL, OLLAMA_TAGS_URL, DEFAULT_MODEL, MAX_TOKENS, OLLAMA_TIMEOUT
from backend.utils import clean_thinking_text
import backend.database as db

logger = logging.getLogger(__name__)

# System Prompts for different Assistant Modes
BASE_SYSTEM_PROMPT = """You are a helpful, intelligent, privacy-focused local AI assistant running 100% locally on the user's machine.
Provide direct, complete, accurate, and well-structured responses.
Use GitHub-flavored Markdown with code blocks, tables, and lists where appropriate.
Never output internal thought monologues, reasoning tags, or <think> tags."""

CODING_SYSTEM_PROMPT = """You are an expert Senior Software Engineer and Coding Assistant.
You write clean, modular, performant, and secure code.
When debugging, explain the root cause and provide the exact fix.
Always wrap code snippets in appropriate markdown code fences with the language identifier (e.g. ```python, ```javascript, ```html).
Never execute code or claim you executed it. Focus on precision, best practices, and actionable explanations."""

DOC_SYSTEM_PROMPT = """You are a precise Document Analysis Assistant.
Your task is to answer questions strictly grounded in the provided document excerpts.
Always cite page numbers (e.g., "[Page X]") when referencing facts from the document.
If the provided document excerpts do not contain the answer, state honestly: "The provided document does not contain this information." Do not hallucinate or make up facts."""

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
        res = requests.get(OLLAMA_TAGS_URL, timeout=4)
        if res.status_code == 200:
            models = res.json().get("models", [])
            return [m.get("name", "") for m in models if m.get("name")]
    except Exception as e:
        logger.error(f"Error fetching Ollama models: {e}")
    return []

def select_best_local_model(requested_model: Optional[str] = None) -> str:
    """
    Selects model: requested model if installed, otherwise fastest available local model.
    """
    installed = get_installed_models()
    if requested_model and (requested_model in installed or any(requested_model in m for m in installed)):
        return requested_model
    if not installed:
        return DEFAULT_MODEL
    
    # Priority preference for fast inference
    fast_models = ["qwen2.5:1.5b", "qwen2.5:0.5b", "llama3.2:1b", "qwen3:4b", "tinyllama"]
    for pref in fast_models:
        for m in installed:
            if pref in m or m.startswith(pref):
                return m
    return installed[0]

def check_model_available(model_name: str = DEFAULT_MODEL) -> bool:
    """Checks whether requested model or any local model is pulled in Ollama."""
    installed = get_installed_models()
    return len(installed) > 0

def build_chat_messages(
    prompt: str,
    history: Optional[List[Dict[str, str]]] = None,
    mode: str = "chat",
    doc_context: Optional[str] = None,
    include_memories: bool = True
) -> List[Dict[str, str]]:
    """
    Builds structured chat messages with mode-specific instructions,
    user memories, and document context.
    """
    # 1. Base system prompt by mode
    if mode == "code":
        system_text = CODING_SYSTEM_PROMPT
    elif mode == "doc":
        system_text = DOC_SYSTEM_PROMPT
    else:
        system_text = BASE_SYSTEM_PROMPT

    # 2. Inject active user memories if enabled
    if include_memories:
        try:
            active_mems = db.list_memories(active_only=True)
            if active_mems:
                mem_lines = [f"- {m['content']}" for m in active_mems[:10]]
                system_text += "\n\nUser Profile & Saved Preferences (honor these instructions):\n" + "\n".join(mem_lines)
        except Exception as e:
            logger.warning(f"Could not load memories for prompt context: {e}")

    # 3. Inject document context if provided
    if doc_context:
        system_text += f"\n\n--- RELEVANT DOCUMENT EXCERPTS ---\n{doc_context}\n--- END DOCUMENT EXCERPTS ---"

    messages = [{"role": "system", "content": system_text}]

    # 4. Append conversation history (limited to last 8 turns to stay within context budget)
    if history:
        valid_history = [
            m for m in history 
            if isinstance(m, dict) and m.get("role") and m.get("content") and m.get("role") in ("user", "assistant")
        ]
        for msg in valid_history[-8:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

    # 5. Append current user prompt
    messages.append({"role": "user", "content": prompt})
    return messages

def generate_response_stream(
    prompt: str,
    history: Optional[List[Dict[str, str]]] = None,
    model_name: Optional[str] = None,
    mode: str = "chat",
    doc_context: Optional[str] = None,
    temperature: float = 0.3
) -> Generator[str, None, None]:
    """
    Streams response token-by-token from local Ollama model.
    Yields text chunks as they arrive.
    """
    if not check_ollama_health():
        raise RuntimeError("Ollama is not running. Please start Ollama at http://localhost:11434.")

    chosen_model = select_best_local_model(model_name)
    messages = build_chat_messages(prompt, history, mode=mode, doc_context=doc_context)

    payload = {
        "model": chosen_model,
        "messages": messages,
        "stream": True,
        "think": False,
        "options": {
            "num_predict": MAX_TOKENS,
            "num_ctx": 4096,
            "temperature": temperature,
            "num_thread": max(1, (os.cpu_count() or 4))
        }
    }

    try:
        response = requests.post(
            OLLAMA_CHAT_URL,
            json=payload,
            stream=True,
            timeout=(5, OLLAMA_TIMEOUT)
        )
        if response.status_code != 200:
            raise RuntimeError(f"Ollama error (HTTP {response.status_code}): {response.text}")

        inside_think = False
        for line in response.iter_lines():
            if not line:
                continue
            try:
                chunk_data = json.loads(line.decode("utf-8"))
                content = chunk_data.get("message", {}).get("content", "")
                
                # Filter out <think> tags on the fly
                if "<think>" in content:
                    inside_think = True
                    content = content.replace("<think>", "")
                if "</think>" in content:
                    inside_think = False
                    content = content.split("</think>")[-1]

                if not inside_think and content:
                    yield content

                if chunk_data.get("done", False):
                    break
            except Exception:
                continue
    except requests.exceptions.Timeout:
        raise RuntimeError(f"Model generation timed out after {OLLAMA_TIMEOUT}s.")
    except Exception as e:
        logger.error(f"Streaming error with model '{chosen_model}': {e}")
        raise RuntimeError(f"Local AI streaming error: {str(e)}")

def generate_response(
    prompt: str,
    history: Optional[List[Dict[str, str]]] = None,
    model_name: Optional[str] = None,
    mode: str = "chat",
    doc_context: Optional[str] = None
) -> str:
    """
    Non-streaming response generator (aggregates stream or direct call).
    """
    full_text = []
    for chunk in generate_response_stream(
        prompt=prompt,
        history=history,
        model_name=model_name,
        mode=mode,
        doc_context=doc_context
    ):
        full_text.append(chunk)
    
    result = "".join(full_text)
    return clean_thinking_text(result)
