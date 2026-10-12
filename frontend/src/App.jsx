import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ChatWindow from './components/ChatWindow';
import InputBox from './components/InputBox';
import {
  checkModelStatus,
  sendChatMessage,
  transcribeAudio,
  clearChatHistory,
} from './services/api';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState('ready'); // ready, listening, transcribing, thinking, speaking, error
  const [statusMessage, setStatusMessage] = useState('● Local Ready');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeModel, setActiveModel] = useState('qwen2.5:1.5b');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const isSpeechRecActiveRef = useRef(false);
  const isFallbackInitiatedRef = useRef(false);

  useEffect(() => {
    verifySystemStatus();
  }, []);

  const verifySystemStatus = async () => {
    try {
      const data = await checkModelStatus();
      setActiveModel(data.model || 'qwen2.5:1.5b');

      if (data.ollama_running) {
        setStatus('ready');
        setStatusMessage('● Local Ready');
        setErrorMessage('');
      } else {
        setStatus('error');
        setStatusMessage('● Ollama Offline');
        setErrorMessage('Ollama is not running. Please start Ollama service at http://localhost:11434.');
      }
    } catch (err) {
      setStatus('error');
      setStatusMessage('● Backend Offline');
      setErrorMessage('Backend server is not reachable. Please start the backend service.');
    }
  };

  const speakResponse = (text) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) {
      setStatus('ready');
      setStatusMessage('● Local Ready');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setStatus('speaking');
        setStatusMessage('🔊 Speaking...');
      };

      utterance.onend = () => {
        setStatus('ready');
        setStatusMessage('● Local Ready');
      };

      utterance.onerror = () => {
        setStatus('ready');
        setStatusMessage('● Local Ready');
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
      setStatus('ready');
      setStatusMessage('● Local Ready');
    }
  };

  const handleSendMessage = async (textToSend) => {
    const prompt = textToSend || inputText;
    if (!prompt || !prompt.trim()) return;

    window.speechSynthesis?.cancel();

    const cleanPrompt = prompt.trim();
    const userMsg = { role: 'user', content: cleanPrompt };
    const previousHistory = messages;

    setMessages((prev) => [...prev, userMsg]);
    setInputText(''); // Clear input box after sending

    setStatus('thinking');
    setStatusMessage('🤔 Local AI Thinking...');
    setErrorMessage('');

    try {
      const data = await sendChatMessage(cleanPrompt, previousHistory);
      
      const assistantMsg = { role: 'assistant', content: data.response };
      if (data.history && data.history.length > 0) {
        setMessages(data.history);
      } else {
        setMessages((prev) => [...prev, assistantMsg]);
      }

      if (voiceEnabled) {
        speakResponse(data.response);
      } else {
        setStatus('ready');
        setStatusMessage('● Local Ready');
      }
    } catch (err) {
      setStatus('error');
      setStatusMessage('● Error');
      const errText = err.message || 'Failed to process request.';
      setErrorMessage(errText);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ Error: ${errText}` },
      ]);
    }
  };

  const startMediaRecorderFallback = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        if (!window.isSecureContext) {
          throw new Error('Mobile browser microphone sathi HTTPS lagto. Krupaya URL madhe https:// vapara (e.g. https://<IP>:5174)');
        }
        throw new Error('Microphone API is not supported on this device/browser.');
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

      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const mime = mediaRecorderRef.current.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        stream.getTracks().forEach((track) => track.stop());

        if (audioBlob.size > 0) {
          await handleTranscribe(audioBlob);
        } else {
          setStatus('ready');
          setStatusMessage('● Local Ready');
        }
      };

      mediaRecorderRef.current.start(200);
      setIsRecording(true);
      setStatus('listening');
      setStatusMessage('🔴 Recording audio...');
    } catch (err) {
      console.error('Microphone access error:', err);
      setIsRecording(false);
      setStatus('error');
      setStatusMessage('● Mic Access Denied');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access denied. Krupaya browser settings / address bar madhun microphone ALLOW kara.');
      } else {
        setErrorMessage(err.message || 'Microphone access failed. Please check permissions.');
      }
    }
  };

  const handleStartRecord = async () => {
    window.speechSynthesis?.cancel();
    setErrorMessage('');
    isFallbackInitiatedRef.current = false;

    // Method 1: Web Speech API (Instant Live Real-Time Speech Recognition)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        // Support browser language (e.g. mr-IN, hi-IN, en-US)
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
            // Live populate text inside the input box as user speaks!
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

        recognition.onend = async () => {
          if (isFallbackInitiatedRef.current) {
            return;
          }
          isSpeechRecActiveRef.current = false;
          setIsRecording(false);
          // If speech was recognized and typed into box, automatically send it
          if (inputText && inputText.trim()) {
            await handleSendMessage(inputText.trim());
          } else {
            setStatus('ready');
            setStatusMessage('● Local Ready');
          }
        };

        recognition.start();
        return;
      } catch (e) {
        console.warn('Web Speech API initialization failed, using MediaRecorder fallback:', e);
      }
    }

    // Method 2: MediaRecorder + Backend Whisper Fallback
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
    setStatusMessage('⏳ Transcribing audio...');

    try {
      const data = await transcribeAudio(audioBlob);
      const recognizedText = data.text;

      if (!recognizedText || !recognizedText.trim()) {
        setStatus('ready');
        setStatusMessage('● Local Ready (No speech detected)');
        return;
      }

      // Populate text inside input box and send
      setInputText(recognizedText);
      await handleSendMessage(recognizedText);
    } catch (err) {
      setStatus('error');
      setStatusMessage('● Speech Error');
      setErrorMessage(err.message || 'Could not understand the audio. Please try again.');
    }
  };

  const handleClearChat = async () => {
    window.speechSynthesis?.cancel();
    try {
      await clearChatHistory();
    } catch (err) {
      console.warn('Backend clear chat warning:', err);
    }
    setMessages([]);
    setInputText('');
    setStatus('ready');
    setStatusMessage('● Local Ready');
    setErrorMessage('');
  };

  return (
    <div className="app-container">
      <Header
        status={status}
        statusMessage={statusMessage}
        activeModel={activeModel}
      />

      {errorMessage && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
          <button className="error-dismiss-btn" onClick={() => setErrorMessage('')}>
            ✕
          </button>
        </div>
      )}

      <ChatWindow messages={messages} status={status} />

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
      />
    </div>
  );
}
