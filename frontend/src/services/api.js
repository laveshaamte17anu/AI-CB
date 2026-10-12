const API_BASE = '/api';

/**
 * Checks backend health.
 */
export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Checks local Ollama qwen3:4b status.
 */
export async function checkModelStatus() {
  const response = await fetch(`${API_BASE}/model`);
  if (!response.ok) {
    throw new Error(`Model status check failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Sends chat message with conversation history to local Ollama qwen3:4b backend.
 */
export async function sendChatMessage(message, history = []) {
  const payload = { message, history };

  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Chat request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Uploads audio blob for local Whisper Speech-to-Text transcription.
 */
export async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  let filename = 'voice_input.webm';
  if (audioBlob.type) {
    if (audioBlob.type.includes('mp4')) {
      filename = 'voice_input.mp4';
    } else if (audioBlob.type.includes('aac')) {
      filename = 'voice_input.aac';
    } else if (audioBlob.type.includes('ogg')) {
      filename = 'voice_input.ogg';
    } else if (audioBlob.type.includes('wav')) {
      filename = 'voice_input.wav';
    }
  }
  formData.append('file', audioBlob, filename);

  const response = await fetch(`${API_BASE}/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Could not understand the audio. Please try again.');
  }

  return response.json();
}

/**
 * Clears conversation history on backend.
 */
export async function clearChatHistory() {
  const response = await fetch(`${API_BASE}/clear`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Clear chat failed with status ${response.status}`);
  }
  return response.json();
}
