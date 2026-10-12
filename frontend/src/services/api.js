const API_BASE = '/api';

/**
 * Health check endpoint.
 */
export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }
  return response.json();
}

/**
 * Checks local model and installed Ollama models.
 */
export async function checkModelStatus() {
  const response = await fetch(`${API_BASE}/model`);
  if (!response.ok) {
    throw new Error(`Model status check failed (${response.status})`);
  }
  return response.json();
}

/**
 * Switch active model preference.
 */
export async function selectModel(modelName) {
  const response = await fetch(`${API_BASE}/model/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelName }),
  });
  if (!response.ok) {
    throw new Error('Failed to update model');
  }
  return response.json();
}

/**
 * Fetch list of conversations (with optional search query).
 */
export async function getConversations(searchQuery = '') {
  const url = searchQuery ? `${API_BASE}/conversations?q=${encodeURIComponent(searchQuery)}` : `${API_BASE}/conversations`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch conversations');
  }
  return response.json();
}

/**
 * Create a new conversation.
 */
export async function createConversation(title = 'New Chat', mode = 'chat') {
  const response = await fetch(`${API_BASE}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, mode }),
  });
  if (!response.ok) {
    throw new Error('Failed to create conversation');
  }
  return response.json();
}

/**
 * Fetch a conversation by ID with its messages.
 */
export async function getConversation(convId) {
  const response = await fetch(`${API_BASE}/conversations/${convId}`);
  if (!response.ok) {
    throw new Error('Failed to load conversation');
  }
  return response.json();
}

/**
 * Rename a conversation.
 */
export async function renameConversation(convId, newTitle) {
  const response = await fetch(`${API_BASE}/conversations/${convId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: newTitle }),
  });
  if (!response.ok) {
    throw new Error('Failed to rename conversation');
  }
  return response.json();
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(convId) {
  const response = await fetch(`${API_BASE}/conversations/${convId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete conversation');
  }
  return response.json();
}

/**
 * Standard non-streaming chat request.
 */
export async function sendChatMessage(message, conversationId, mode = 'chat', model = null, history = []) {
  const payload = { message, conversation_id: conversationId, mode, model, history };

  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Chat request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Streaming chat request using Server-Sent Events (SSE).
 * Calls onChunk(token), onDone(fullText, convId, sources), onError(err).
 */
export async function streamChatMessage({
  message,
  conversationId,
  mode = 'chat',
  model = null,
  onStart,
  onChunk,
  onDone,
  onError,
  signal,
}) {
  try {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        mode,
        model,
      }),
      signal,
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.detail || `Stream failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';
    let serverConvId = conversationId;
    let sources = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop(); // Keep partial line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          try {
            const data = JSON.parse(trimmed.replace(/^data:\s*/, ''));
            if (data.event === 'start') {
              serverConvId = data.conversation_id;
              sources = data.sources || [];
              if (onStart) onStart({ conversationId: serverConvId, sources });
            } else if (data.event === 'chunk') {
              accumulatedText += data.text;
              if (onChunk) onChunk(data.text, accumulatedText);
            } else if (data.event === 'done') {
              if (onDone) onDone(data.full_text || accumulatedText, data.conversation_id || serverConvId, sources);
              return;
            } else if (data.event === 'error') {
              throw new Error(data.error || 'Streaming error');
            }
          } catch (e) {
            console.warn('Error parsing SSE event:', e);
          }
        }
      }
    }

    if (onDone) onDone(accumulatedText, serverConvId, sources);
  } catch (err) {
    if (signal?.aborted) {
      if (onDone) onDone(null, conversationId, []);
      return;
    }
    if (onError) onError(err);
    else throw err;
  }
}

/**
 * Memory Management API
 */
export async function getMemories() {
  const response = await fetch(`${API_BASE}/memories`);
  if (!response.ok) throw new Error('Failed to fetch memories');
  return response.json();
}

export async function addMemory(content, category = 'fact', key = null) {
  const response = await fetch(`${API_BASE}/memories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, category, key }),
  });
  if (!response.ok) throw new Error('Failed to add memory');
  return response.json();
}

export async function updateMemory(id, content, isActive) {
  const response = await fetch(`${API_BASE}/memories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, is_active: isActive }),
  });
  if (!response.ok) throw new Error('Failed to update memory');
  return response.json();
}

export async function deleteMemory(id) {
  const response = await fetch(`${API_BASE}/memories/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete memory');
  return response.json();
}

export async function clearAllMemories() {
  const response = await fetch(`${API_BASE}/memories`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to clear memories');
  return response.json();
}

/**
 * Document Management API
 */
export async function uploadDocument(file, conversationId = null) {
  const formData = new FormData();
  formData.append('file', file);
  if (conversationId) formData.append('conversation_id', conversationId);

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Document upload failed');
  }

  return response.json();
}

export async function getDocuments(conversationId = null) {
  const url = conversationId ? `${API_BASE}/documents?conversation_id=${conversationId}` : `${API_BASE}/documents`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch documents');
  return response.json();
}

export async function deleteDocument(docId) {
  const response = await fetch(`${API_BASE}/documents/${docId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete document');
  return response.json();
}

/**
 * Faster-Whisper Speech-to-Text
 */
export async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  let filename = 'voice_input.webm';
  if (audioBlob.type) {
    if (audioBlob.type.includes('mp4')) filename = 'voice_input.mp4';
    else if (audioBlob.type.includes('aac')) filename = 'voice_input.aac';
    else if (audioBlob.type.includes('ogg')) filename = 'voice_input.ogg';
    else if (audioBlob.type.includes('wav')) filename = 'voice_input.wav';
  }
  formData.append('file', audioBlob, filename);

  const response = await fetch(`${API_BASE}/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Could not transcribe the audio. Please try again.');
  }

  return response.json();
}

/**
 * Clears conversation history on backend.
 */
export async function clearChatHistory() {
  const response = await fetch(`${API_BASE}/clear`, { method: 'POST' });
  if (!response.ok) throw new Error(`Clear chat failed`);
  return response.json();
}
