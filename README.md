# 🤖 Local AI Voice Assistant

A 100% local, privacy-focused AI Voice & Text Assistant built with **React**, **FastAPI**, **faster-whisper**, and **Ollama** running **Qwen3:4B**.

No cloud APIs, no API keys, and no internet connection required after setup.

---

## 🏗️ Architecture & How It Works

```text
🎤 Microphone Input
      ↓
React (MediaRecorder Web API)
      ↓
FastAPI Backend (/api/transcribe)
      ↓
Local Whisper (faster-whisper CPU int8)
      ↓
Recognized Text
      ↓
FastAPI Backend (/api/chat)
      ↓
Local Ollama API (qwen3:4b model)
      ↓
Cleaned AI Response (Reasoning/Think tags stripped)
      ↓
React Chat Interface
      ↓
🔊 Local Browser TTS (window.speechSynthesis)
```

For typed questions, the Speech-to-Text phase is bypassed directly to Ollama.

---

## ⚙️ Prerequisites & Setup Guide

### Step 1: Install Node.js
Download and install Node.js (v18+ recommended) from [nodejs.org](https://nodejs.org/).

### Step 2: Install Python
Install Python 3.10+ from [python.org](https://python.org/).

### Step 3: Install Ollama
Download and install Ollama from [ollama.com](https://ollama.com/). Ensure Ollama is running at `http://localhost:11434`.

### Step 4: Pull the Qwen3:4B Model
Run the following command in your terminal:
```bash
ollama pull qwen3:4b
```

### Step 5: Install Project Dependencies

**Backend Dependencies:**
```bash
pip install -r requirements.txt
```

**Frontend Dependencies:**
```bash
cd frontend
npm install
cd ..
```

---

## 🚀 Running the Application

### Option A: Automatic Startup (Windows)
Double-click `run.bat` or run:
```cmd
run.bat
```
This automatically launches the FastAPI backend on port 8002, Vite dev server on port 5174, and opens your browser.

### Option B: Manual Startup

**1. Start Backend:**
From project root:
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8002 --reload
```
Or if you are inside `backend` folder:
```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8002 --reload
```
(or simply: `python main.py`)

**2. Start Frontend:**
```bash
cd frontend
npm run dev
```

Open `http://localhost:5174` in your browser.

---

## 🧪 Testing

Run automated tests:
```bash
pytest tests/
```

---

## 📁 Project Structure

```text
local-ai-assistant/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWindow.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── InputBox.jsx
│   │   │   ├── Message.jsx
│   │   │   ├── MicButton.jsx
│   │   │   └── StatusIndicator.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
│
├── backend/
│   ├── main.py
│   ├── ollama_client.py
│   ├── speech_to_text.py
│   ├── assistant.py
│   ├── conversation.py
│   ├── config.py
│   ├── utils.py
│   └── requirements.txt
│
├── tests/
│   ├── test_health.py
│   └── test_chat.py
│
├── .env.example
├── .gitignore
├── README.md
└── run.bat
```

---

## 🛡️ Privacy & Security
* All audio recordings are processed in-memory / temporary files and deleted immediately after transcription.
* No data is sent to external servers or cloud providers.
