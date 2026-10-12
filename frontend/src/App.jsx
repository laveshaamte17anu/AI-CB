import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import InputBox from './components/InputBox';
import MemoryModal from './components/MemoryModal';
import DocumentDrawer from './components/DocumentDrawer';
import {
  checkModelStatus,
  selectModel,
  getConversations,
  createConversation,
  getConversation,
  renameConversation,
  deleteConversation,
  streamChatMessage,
  getMemories,
  addMemory,
  updateMemory,
  deleteMemory,
  clearAllMemories,
  uploadDocument,
  getDocuments,
  deleteDocument,
  transcribeAudio,
} from './services/api';
import { AlertCircle } from 'lucide-react';

export default function App() {
  // Conversation state
  const [conversations, setConversations] = useState([]);
  const [currentConvId, setCurrentConvId] = useState(null);
  const [currentConvTitle, setCurrentConvTitle] = useState('New Chat');
  const [messages, setMessages] = useState([]);
  const [activeMode, setActiveMode] = useState('chat'); // 'chat' | 'code' | 'doc'
  const [searchQuery, setSearchQuery] = useState('');

  // Model state
  const [activeModel, setActiveModel] = useState('qwen2.5:1.5b');
  const [models, setModels] = useState([]);

  // Memory & Document states
  const [memories, setMemories] = useState([]);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [isDocDrawerOpen, setIsDocDrawerOpen] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Chat & Streaming state
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState('ready'); // ready, listening, transcribing, thinking, streaming, speaking, error
  const [statusMessage, setStatusMessage] = useState('● Local Ready');
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Voice & Audio state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);

  // Layout state
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const isSpeechRecActiveRef = useRef(false);
  const isFallbackInitiatedRef = useRef(false);
  const abortControllerRef = useRef(null);

  // Initialize data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // 1. Check Model & Ollama
      const modelData = await checkModelStatus();
      setActiveModel(modelData.model || 'qwen2.5:1.5b');
      setModels(modelData.installed_models || []);

      if (modelData.ollama_running) {
        setStatus('ready');
        setStatusMessage('● Local Ready');
        setErrorMessage('');
      } else {
        setStatus('error');
        setStatusMessage('● Ollama Offline');
        setErrorMessage('Ollama is not running. Please start Ollama at http://localhost:11434.');
      }
    } catch (err) {
      setStatus('error');
      setStatusMessage('● Backend Offline');
      setErrorMessage('Backend server is not reachable. Please start the backend service.');
    }

    // 2. Load conversations
    try {
      const convList = await getConversations();
      setConversations(convList);

      if (convList.length > 0) {
        await loadConversation(convList[0].id);
      } else {
        await handleNewConversation('chat');
      }
    } catch (err) {
      console.warn('Could not load conversations:', err);
    }

    // 3. Load memories & documents
    loadMemories();
    loadDocuments();
  };

  const loadMemories = async () => {
    try {
      const mems = await getMemories();
      setMemories(mems);
    } catch (e) {
      console.warn('Could not load memories:', e);
    }
  };

  const loadDocuments = async () => {
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (e) {
      console.warn('Could not load documents:', e);
    }
  };

  const loadConversation = async (convId) => {
    try {
      const data = await getConversation(convId);
      setCurrentConvId(data.id);
      setCurrentConvTitle(data.title);
      setActiveMode(data.mode || 'chat');
      setMessages(data.messages || []);
      // Close sidebar on mobile after selection
      if (window.innerWidth <= 768) {
        setIsSidebarOpen(false);
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
    }
  };

  const handleNewConversation = async (mode = 'chat') => {
    try {
      const newConv = await createConversation('New Chat', mode);
      setConversations((prev) => [newConv, ...prev]);
      setCurrentConvId(newConv.id);
      setCurrentConvTitle(newConv.title);
      setActiveMode(mode);
      setMessages([]);
      setInputText('');
      if (window.innerWidth <= 768) {
        setIsSidebarOpen(false);
      }
    } catch (err) {
      setErrorMessage('Failed to create new conversation');
    }
  };

  const handleSearchConversations = async (query) => {
    setSearchQuery(query);
    try {
      const results = await getConversations(query);
      setConversations(results);
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const handleRenameConversation = async (convId, newTitle) => {
    try {
      await renameConversation(convId, newTitle);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: newTitle } : c))
      );
      if (currentConvId === convId) {
        setCurrentConvTitle(newTitle);
      }
    } catch (err) {
      setErrorMessage('Failed to rename conversation');
    }
  };

  const handleDeleteConversation = async (convId) => {
    try {
      await deleteConversation(convId);
      const remaining = conversations.filter((c) => c.id !== convId);
      setConversations(remaining);

      if (currentConvId === convId) {
        if (remaining.length > 0) {
          await loadConversation(remaining[0].id);
        } else {
          await handleNewConversation(activeMode);
        }
      }
    } catch (err) {
      setErrorMessage('Failed to delete conversation');
    }
  };

  const handleSelectModel = async (modelName) => {
    try {
      await selectModel(modelName);
      setActiveModel(modelName);
    } catch (err) {
      setErrorMessage('Failed to switch model');
    }
  };

  // --- CHAT & STREAMING LOGIC ---

  const handleSendMessage = async (textToSend) => {
    const prompt = textToSend || inputText;
    if (!prompt || !prompt.trim() || isStreaming) return;

    window.speechSynthesis?.cancel();
    setSpeakingMessageId(null);

    const cleanPrompt = prompt.trim();
    const tempUserMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: cleanPrompt,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setInputText('');
    setStatus('thinking');
    setStatusMessage('🤔 Local AI Thinking...');
    setErrorMessage('');
    setIsStreaming(true);
    setStreamingContent('');

    // Setup abort controller for stop generation
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await streamChatMessage({
        message: cleanPrompt,
        conversationId: currentConvId,
        mode: activeMode,
        model: activeModel,
        signal: abortController.signal,
        onStart: ({ conversationId }) => {
          if (conversationId && conversationId !== currentConvId) {
            setCurrentConvId(conversationId);
          }
          setStatus('streaming');
          setStatusMessage('⚡ Generating response...');
        },
        onChunk: (chunk, accumulated) => {
          setStreamingContent(accumulated);
        },
        onDone: (fullText, serverConvId, sources) => {
          setIsStreaming(false);
          setStreamingContent('');
          setStatus('ready');
          setStatusMessage('● Local Ready');

          if (fullText) {
            const assistantMsg = {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: fullText,
              metadata: sources && sources.length > 0 ? { sources } : {},
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMsg]);

            // Voice read aloud if voiceEnabled
            if (voiceEnabled) {
              speakText(fullText, assistantMsg.id);
            }
          }

          // Refresh conversation list for updated titles/previews
          getConversations().then(setConversations).catch(() => {});
        },
        onError: (err) => {
          setIsStreaming(false);
          setStreamingContent('');
          setStatus('error');
          setStatusMessage('● Generation Error');
          const errText = err.message || 'Generation failed.';
          setErrorMessage(errText);
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: 'assistant',
              content: `⚠️ Error: ${errText}`,
              created_at: new Date().toISOString(),
            },
          ]);
        },
      });
    } catch (err) {
      setIsStreaming(false);
      setStreamingContent('');
      setStatus('error');
      setStatusMessage('● Error');
      setErrorMessage(err.message || 'Failed to process request.');
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setStatus('ready');
      setStatusMessage('● Generation Stopped');

      if (streamingContent) {
        const assistantMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: streamingContent + ' *(stopped)*',
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
      setStreamingContent('');
    }
  };

  const handleRetryLastMessage = () => {
    if (isStreaming) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    // Prune messages back to the last user message
    const lastUserIndex = messages.map((m) => m.id).lastIndexOf(lastUserMsg.id);
    if (lastUserIndex !== -1) {
      setMessages(messages.slice(0, lastUserIndex + 1));
    }

    setErrorMessage('');
    handleSendMessage(lastUserMsg.content);
  };

  // --- SPEECH SYNTHESIS (TTS) ---

  const cleanTextForSpeech = (rawText) => {
    if (!rawText || typeof rawText !== 'string') return '';

    let cleaned = rawText
      // Remove fenced code blocks (```...```)
      .replace(/```[\s\S]*?```/g, ' ')
      // Remove inline code snippets (`code`)
      .replace(/`([^`]+)`/g, '$1')
      // Remove Markdown images ![alt](url)
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      // Replace Markdown links [text](url) with just 'text'
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove raw URLs so TTS doesn't spell out http/https
      .replace(/https?:\/\/\S+/gi, '')
      // Remove markdown headers: #, ##, ###, etc. at start of line
      .replace(/^[ \t]*#+[ \t]*/gm, '')
      // Remove any remaining hash / hashtag symbols anywhere in the text
      .replace(/#+/g, '')
      // Remove bold/italics syntax: ***text***, **text**, *text*, ___text___, __text__, _text_
      .replace(/(\*{1,3}|_{1,3})([^\*_]+)\1/g, '$2')
      // Remove strikethrough (~~text~~)
      .replace(/~~([^~]+)~~/g, '$1')
      // Remove blockquote indicators (> quote)
      .replace(/^[ \t]*>[ \t]*/gm, '')
      // Remove horizontal rules (---, ***, ___)
      .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, '')
      // Remove markdown bullet points (- item, * item, + item)
      .replace(/^[ \t]*[-*+]\s+/gm, '')
      // Replace markdown table pipes with spaces
      .replace(/\|/g, ' ')
      // Remove HTML tags
      .replace(/<[^>]*>/g, '');

    // Pacing and sentence smoothing for TTS:
    cleaned = cleaned
      // If a line doesn't end with sentence-ending punctuation, append a period for a clean pause
      .replace(/([^.!?\s])\n+/g, '$1. ')
      // Replace remaining consecutive linebreaks with a space
      .replace(/\n+/g, ' ')
      // Collapse duplicate periods (e.g. "..")
      .replace(/\.{2,}/g, '.')
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  };

  const speakText = (text, messageId = null) => {
    if (!('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();
      const cleaned = cleanTextForSpeech(text);
      if (!cleaned) return;

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setSpeakingMessageId(messageId);
        setStatus('speaking');
        setStatusMessage('🔊 Speaking response...');
      };

      utterance.onend = () => {
        setSpeakingMessageId(null);
        setStatus('ready');
        setStatusMessage('● Local Ready');
      };

      utterance.onerror = () => {
        setSpeakingMessageId(null);
        setStatus('ready');
        setStatusMessage('● Local Ready');
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('TTS Error:', err);
    }
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
    setStatus('ready');
    setStatusMessage('● Local Ready');
  };

  // --- SPEECH-TO-TEXT (VOICE INPUT) ---

  const startMediaRecorderFallback = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        if (!window.isSecureContext) {
          throw new Error('Microphone requires HTTPS on mobile/network devices. Please open using https://');
        }
        throw new Error('Microphone API not supported on this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const options = {};
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options.mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options.mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options.mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          options.mimeType = 'audio/aac';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mime = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        stream.getTracks().forEach((track) => track.stop());

        if (audioBlob.size > 0) {
          await handleTranscribe(audioBlob);
        } else {
          setStatus('ready');
          setStatusMessage('● Local Ready');
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setStatus('listening');
      setStatusMessage('🔴 Recording audio... (Speak now)');
    } catch (err) {
      console.error('Microphone error:', err);
      setIsRecording(false);
      setStatus('error');
      setStatusMessage('● Mic Access Denied');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access denied. Please click the lock icon in your browser address bar to allow microphone.');
      } else {
        setErrorMessage(err.message || 'Microphone access failed.');
      }
    }
  };

  const handleStartRecord = async () => {
    stopSpeech();
    setErrorMessage('');
    isFallbackInitiatedRef.current = false;

    // Use Web Speech API if supported for live text typing
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = navigator.language || 'en-US';

        recognitionRef.current = recognition;

        recognition.onstart = () => {
          isSpeechRecActiveRef.current = true;
          setIsRecording(true);
          setStatus('listening');
          setStatusMessage('🔴 Listening... Speak now');
        };

        recognition.onresult = (event) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            setInputText(transcript);
            setStatusMessage(`🔴 Spoken: "${transcript}"`);
          }
        };

        recognition.onerror = (event) => {
          console.warn('Speech recognition notice:', event.error);
          isSpeechRecActiveRef.current = false;
          if (event.error !== 'no-speech' && !isFallbackInitiatedRef.current) {
            isFallbackInitiatedRef.current = true;
            startMediaRecorderFallback();
          }
        };

        recognition.onend = () => {
          if (isFallbackInitiatedRef.current) return;
          isSpeechRecActiveRef.current = false;
          setIsRecording(false);
          setStatus('ready');
          if (inputText && inputText.trim()) {
            setStatusMessage('● Speech transcribed. Review/edit or press Send.');
          } else {
            setStatusMessage('● Local Ready');
          }
        };

        recognition.start();
        return;
      } catch (e) {
        console.warn('Web Speech API failed, using MediaRecorder fallback:', e);
      }
    }

    // MediaRecorder + local faster-whisper fallback
    isFallbackInitiatedRef.current = true;
    await startMediaRecorderFallback();
  };

  const handleStopRecord = () => {
    if (recognitionRef.current && isRecording && isSpeechRecActiveRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn(e);
      }
      isSpeechRecActiveRef.current = false;
      setIsRecording(false);
      return;
    }

    if (mediaRecorderRef.current && isRecording) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.warn(e);
      }
      setIsRecording(false);
    }
  };

  const handleTranscribe = async (audioBlob) => {
    setStatus('transcribing');
    setStatusMessage('⏳ Transcribing audio with local Whisper...');

    try {
      const data = await transcribeAudio(audioBlob);
      const recognizedText = data.text;

      if (!recognizedText || !recognizedText.trim()) {
        setStatus('ready');
        setStatusMessage('● Local Ready (No speech detected)');
        return;
      }

      setInputText(recognizedText);
      setStatus('ready');
      setStatusMessage('● Speech transcribed. Review/edit or press Send.');
    } catch (err) {
      setStatus('error');
      setStatusMessage('● Speech Error');
      setErrorMessage(err.message || 'Could not understand the audio. Please try again.');
    }
  };

  // --- MEMORY HANDLERS ---

  const handleAddMemory = async (content, category) => {
    try {
      const newMem = await addMemory(content, category);
      setMemories((prev) => [newMem, ...prev]);
    } catch (err) {
      setErrorMessage('Failed to add memory');
    }
  };

  const handleToggleMemory = async (id, isActive) => {
    try {
      await updateMemory(id, null, isActive ? 1 : 0);
      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_active: isActive ? 1 : 0 } : m))
      );
    } catch (err) {
      setErrorMessage('Failed to update memory status');
    }
  };

  const handleDeleteMemory = async (id) => {
    try {
      await deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setErrorMessage('Failed to delete memory');
    }
  };

  const handleClearMemories = async () => {
    try {
      await clearAllMemories();
      setMemories([]);
    } catch (err) {
      setErrorMessage('Failed to clear memories');
    }
  };

  // --- DOCUMENT HANDLERS ---

  const handleUploadDocument = async (file) => {
    setIsUploadingDoc(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const data = await uploadDocument(file, currentConvId);
      setUploadSuccess(data.message || `Uploaded and parsed ${file.name}`);
      await loadDocuments();
      setTimeout(() => setUploadSuccess(''), 4000);
    } catch (err) {
      setUploadError(err.message || 'Failed to upload document');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setUploadError('Failed to remove document');
    }
  };

  // --- CLEAR CHAT ---

  const handleClearChat = async () => {
    stopSpeech();
    if (currentConvId) {
      await handleDeleteConversation(currentConvId);
    } else {
      setMessages([]);
      setInputText('');
    }
  };

  return (
    <div className="layout-root">
      {/* Sidebar with Navigation & History */}
      <Sidebar
        conversations={conversations}
        currentConvId={currentConvId}
        onSelectConversation={loadConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        searchQuery={searchQuery}
        onSearchChange={handleSearchConversations}
        activeMode={activeMode}
        onChangeMode={(newMode) => {
          setActiveMode(newMode);
          handleNewConversation(newMode);
        }}
        models={models}
        activeModel={activeModel}
        onSelectModel={handleSelectModel}
        onOpenMemoryModal={() => setIsMemoryModalOpen(true)}
        isOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Assistant Dashboard */}
      <div className="main-content-area">
        <Header
          status={status}
          statusMessage={statusMessage}
          activeModel={activeModel}
          activeMode={activeMode}
          conversationTitle={currentConvTitle}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenMemoryModal={() => setIsMemoryModalOpen(true)}
          memoryCount={memories.filter((m) => m.is_active).length}
        />

        {errorMessage && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span className="error-text-content">{errorMessage}</span>
            <button
              className="error-retry-action-btn"
              onClick={handleRetryLastMessage}
              title="Retry last message"
            >
              Retry
            </button>
            <button className="error-dismiss-btn" onClick={() => setErrorMessage('')} title="Dismiss">
              ✕
            </button>
          </div>
        )}

        {/* Chat Window */}
        <ChatWindow
          messages={messages}
          status={status}
          mode={activeMode}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
          onPromptSuggestion={(prompt) => handleSendMessage(prompt)}
          onOpenDocDrawer={() => setIsDocDrawerOpen(true)}
          onSpeakText={(text, id) => speakText(text, id)}
          speakingMessageId={speakingMessageId}
          onStopSpeech={stopSpeech}
          onRegenerate={handleRetryLastMessage}
        />

        {/* Input Composer */}
        <InputBox
          text={inputText}
          onTextChange={setInputText}
          onSendMessage={handleSendMessage}
          isRecording={isRecording}
          onStartRecord={handleStartRecord}
          onStopRecord={handleStopRecord}
          voiceEnabled={voiceEnabled}
          onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
          onClearChat={handleClearChat}
          disabled={status === 'thinking' || status === 'transcribing'}
          isStreaming={isStreaming}
          onStopStreaming={handleStopStreaming}
          mode={activeMode}
          onOpenDocDrawer={() => setIsDocDrawerOpen(true)}
          hasDocuments={documents.length > 0}
        />
      </div>

      {/* Memory Management Modal */}
      <MemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        memories={memories}
        onAddMemory={handleAddMemory}
        onToggleMemory={handleToggleMemory}
        onDeleteMemory={handleDeleteMemory}
        onClearMemories={handleClearMemories}
      />

      {/* Document Drawer Modal */}
      <DocumentDrawer
        isOpen={isDocDrawerOpen}
        onClose={() => setIsDocDrawerOpen(false)}
        documents={documents}
        onUploadDocument={handleUploadDocument}
        onDeleteDocument={handleDeleteDoc}
        isUploading={isUploadingDoc}
        uploadError={uploadError}
        uploadSuccess={uploadSuccess}
      />
    </div>
  );
}
