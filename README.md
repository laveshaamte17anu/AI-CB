# 🤖 Local AI Voice & Document Assistant

A 100% private, local AI personal assistant built with **React (Vite PWA)**, **FastAPI**, **SQLite (WAL)**, **faster-whisper**, and **Ollama** supporting models like **Qwen 2.5 / Qwen 3 / Llama 3**.

Zero cloud APIs, zero subscription fees, zero tracking, and no internet connection required after model download.

---

## 🌟 Key Features

1. **Local AI Chat & Streaming**:
   - Token-by-token streaming inference via Server-Sent Events (SSE).
   - Dynamic model detection, status indicators, and model switcher.
   - Stop-generation and Regenerate / Retry controls.
   - GitHub-flavored Markdown rendering with syntax-highlighted code blocks, copy-response, and copy-code buttons.
   - Automatic `<think>` and internal reasoning filter for thinking models like Qwen 3.

2. **Persistent Conversation History & Memory**:
   - Local SQLite database with Write-Ahead Logging (WAL) and foreign-key constraints.
   - Full conversation CRUD: create new chat, rename, delete with confirmation, and instant search (across titles and message contents).
   - Dedicated Memory Management screen: inspect, add, toggle on/off, delete, or clear saved user preferences and facts.
   - Preserves complete context across page refreshes and server restarts.

3. **Voice Assistant (Privacy-Friendly Speech-to-Text & TTS)**:
   - Microphone input with Web Speech API and local **faster-whisper** (CPU int8) fallback.
   - Transcribed speech is presented in the composer for user inspection/editing before sending.
   - Optional Text-to-Speech (TTS) audio playback with play, pause, and stop controls.
   - Handles multi-language voice input (English, Hindi, Marathi, etc.).

4. **PDF & Document Assistant (Local RAG)**:
   - Drag-and-drop or file-picker upload for PDF, DOCX, TXT, and MD files (up to 25 MB).
   - Automatic page-by-page text extraction, coherent chunking, and keyword indexing.
   - Exact page-level citations (`[Source: filename, Page X]`) displayed in an expandable accordion.
   - Safe input sanitization, strictly local processing, and temporary file cleanup.

5. **Coding Assistant Mode**:
   - Dedicated mode with specialized system prompts for clean, modular, and performant code.
   - Quick one-click action chips: Explain, Debug, Refactor, and Review code.
   - Preserves language context, stack traces, and formatting.

6. **Premium UI & Installable PWA**:
   - Dark theme inspired by modern AI products with glass-like surfaces, subtle gradients, and glowing accents.
   - Fully responsive layout with collapsible sidebar for desktop, tablet, and mobile.
   - Progressive Web App with manifest and service worker caching static assets while bypassing `/api` to protect privacy.

---

## 🏗️ Architecture & Flow

```text
       🎤 Voice Input               📄 PDF / DOCX / TXT Upload
              ↓                                   ↓
    React (MediaRecorder)               Document Parser (pypdf/docx)
              ↓                                   ↓
    FastAPI (/api/transcribe)           Local Chunks & SQLite Index
              ↓                                   ↓
    Faster-Whisper (CPU)                Grounding Context & Citations
              ↓                                   ↓
       Editable Transcript ───────────────> User Prompt
                                                  ↓
                                        FastAPI (/api/chat/stream)
                                                  ↓
                                        Ollama Local Model API
                                                  ↓
                                        Cleaned SSE Token Stream
                                                  ↓
                                        React Markdown + Code Copy
                                                  ↓
                                        TTS Speech Synthesis
```

---

## ⚙️ Prerequisites & Setup Guide

### Step 1: Install Node.js
Download Node.js (v18+) from [nodejs.org](https://nodejs.org/).

### Step 2: Install Python
Install Python 3.10+ from [python.org](https://python.org/).

### Step 3: Install & Start Ollama
1. Download Ollama from [ollama.com](https://ollama.com/).
2. Start Ollama (runs at `http://localhost:11434`).
3. Pull your preferred local model (e.g. `qwen2.5:1.5b` for fast CPU responses, or `qwen3:4b`):
   ```bash
   ollama pull qwen2.5:1.5b
   ```

### Step 4: Install Dependencies

**Backend Python Packages:**
```bash
pip install -r requirements.txt
```

**Frontend Node Modules:**
```bash
cd frontend
npm install
cd ..
```

---

## 🚀 Running the Application

### Option A: Automatic Startup (Windows)
Double-click `run.bat` or run from PowerShell / Command Prompt:
```cmd
run.bat
```
This automatically:
1. Launches the FastAPI backend on port `8765`.
2. Launches the React Vite frontend on port `5174` (HTTPS).
3. Opens `https://localhost:5174` in your default browser.

### Option B: Manual Startup

**1. Start Backend:**
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8765 --reload
```
*(Or `python backend/main.py` directly)*

**2. Start Frontend:**
```bash
cd frontend
npm run dev
```

Open `https://localhost:5174` in your browser. (Accept the local development SSL certificate to enable microphone access in modern browsers).

---

## 🧪 Automated Testing

Run the test suite:
```bash
python -m pytest
```

Run frontend lint & build checks:
```bash
cd frontend
npm run lint
npm run build
```

---

## 📁 Project Structure

```text
local-ai-assistant/
│
├── backend/
│   ├── main.py               # FastAPI application with SSE streaming, documents & memories
│   ├── ollama_client.py      # Ollama client, stream generator, and mode prompt builder
│   ├── database.py           # SQLite persistence (WAL mode) for convs, messages, memories, docs
│   ├── assistant.py          # Chat coordinator and document grounding retrieval
│   ├── document_parser.py    # PDF (pypdf), DOCX (python-docx), TXT chunking and parser
│   ├── speech_to_text.py     # Faster-Whisper CPU int8 transcription pipeline
│   ├── conversation.py       # Session conversation manager
│   ├── config.py             # Central configuration (ports, models, timeouts)
│   ├── utils.py              # Thinking-tag cleaning and temp file utilities
│   ├── data/                 # SQLite database storage (assistant.db) and uploaded docs
│   └── requirements.txt      # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx          # Collapsible navigation, search, conversations CRUD, model selector
│   │   │   ├── Header.jsx           # Status indicator, mode badge, memory quick link
│   │   │   ├── ChatWindow.jsx       # Chat stream view, empty states, suggested prompts
│   │   │   ├── Message.jsx          # Markdown, syntax highlighted code, citations, TTS, retry
│   │   │   ├── InputBox.jsx         # Composer, coding chips, mic button, stop-generation
│   │   │   ├── MicButton.jsx        # Recording toggle button with pulse animation
│   │   │   ├── MemoryModal.jsx      # Memory CRUD dialog (facts, preferences, instructions)
│   │   │   ├── DocumentDrawer.jsx   # Drag-and-drop file upload & document management drawer
│   │   │   └── StatusIndicator.jsx  # Real-time backend & Ollama status badge
│   │   ├── services/
│   │   │   └── api.js               # Typed fetch client with SSE stream reader
│   │   ├── App.jsx                  # Main application state & controller
│   │   ├── main.jsx                 # React root entry point
│   │   └── styles.css               # Premium dark UI stylesheet
│   ├── public/
│   │   ├── manifest.json            # PWA manifest
│   │   ├── sw.js                    # PWA service worker with private caching strategy
│   │   └── favicon.svg              # SVG icons
│   ├── package.json
│   ├── vite.config.js               # Vite dev server with proxy to backend port 8765
│   └── index.html
│
├── tests/
│   ├── test_health.py               # Health & model availability endpoint tests
│   ├── test_chat.py                 # Prompt building, modes, memory context, and thinking filter
│   ├── test_database.py             # SQLite CRUD tests for convs, messages, memories
│   ├── test_document_parser.py      # PDF, DOCX, TXT validation and extraction tests
│   └── test_endpoints.py            # API integration tests (conversations, memories, streaming)
│
├── .env.example                     # Environment variables template
├── requirements.txt                 # Root Python requirements
├── run.bat                          # One-click Windows startup script
└── README.md
```

---

## 🔧 Troubleshooting

1. **Port 8765 already occupied**:
   - The backend checks socket availability on startup and provides clear diagnostics.
   - If occupied, either terminate the older process or change `BACKEND_PORT=8765` in `.env`.
2. **Microphone permission denied**:
   - Modern browsers require HTTPS (or `localhost`) to access the microphone.
   - If prompted by your browser, accept the local self-signed certificate, and click the lock/settings icon in your address bar to allow microphone permissions.
3. **Ollama connection error**:
   - Ensure Ollama is running (`ollama serve` or Ollama desktop app).
   - Test connectivity: `curl http://localhost:11434/api/tags`.
4. **Scanned PDF text not extracted**:
   - If a PDF contains only scanned images, `pypdf` will report that no text layer is present. The assistant warns that OCR is required for purely image-based PDFs.

---

## 🛡️ Privacy & Security

* **Local-First**: All conversation logs and documents are stored in local SQLite (`backend/data/assistant.db`).
* **Zero Cloud Leakage**: No conversation contents, prompts, or documents are transmitted over the internet.
* **Safe Filesystem Handling**: Uploaded files receive sanitized UUID filenames within `backend/data/uploads` and cannot execute code.
