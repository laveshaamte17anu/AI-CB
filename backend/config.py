import os

# Ollama API Configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
OLLAMA_CHAT_URL = f"{OLLAMA_BASE_URL}/api/chat"
OLLAMA_TAGS_URL = f"{OLLAMA_BASE_URL}/api/tags"

# Default Local AI Model (strictly qwen3:4b)
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:4b")

# Speech-to-Text (Whisper) Configuration - CPU optimized
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")  # Options: tiny, base, small
WHISPER_DEVICE = "cpu"
WHISPER_COMPUTE_TYPE = "int8"

# Backend Server Configuration (Port 8002 avoids conflicts with other running projects on 8000/8001)
BACKEND_PORT = int(os.getenv("BACKEND_PORT", 8765))

# LLM Generation Configuration (ensures complete, non-truncated answers)
MAX_TOKENS = int(os.getenv("MAX_TOKENS", 768))
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", 90))
