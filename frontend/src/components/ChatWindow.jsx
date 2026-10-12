import React, { useEffect, useRef } from 'react';
import {
  Bot,
  Sparkles,
  Code2,
  FileText,
  Terminal,
  Bug,
  Cpu,
  BookOpen
} from 'lucide-react';
import Message from './Message';

export default function ChatWindow({
  messages,
  status,
  mode = 'chat',
  streamingContent,
  onPromptSuggestion,
  onOpenDocDrawer,
  onSpeakText,
  speakingMessageId,
  onStopSpeech,
  onRegenerate,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status, streamingContent]);

  const renderEmptyState = () => {
    if (mode === 'code') {
      return (
        <div className="empty-state">
          <div className="empty-header">
            <div className="empty-badge">
              <Code2 size={20} />
            </div>
            <h2>Coding Assistant</h2>
            <p>Write, debug, refactor, and review code with your local AI model.</p>
          </div>

          <div className="suggested-prompts-list">
            <button
              className="prompt-pill"
              onClick={() => onPromptSuggestion("Explain how async/await works in JavaScript with an example.")}
            >
              <Terminal size={14} />
              <span>Explain how async/await works in JavaScript with an example</span>
            </button>

            <button
              className="prompt-pill"
              onClick={() => onPromptSuggestion("Debug this Python error:\nTypeError: 'NoneType' object is not callable\nHow do I fix it?")}
            >
              <Bug size={14} />
              <span>Debug 'NoneType' object is not callable error</span>
            </button>

            <button
              className="prompt-pill"
              onClick={() => onPromptSuggestion("Write a clean, modular Python FastAPI endpoint to validate and parse uploaded CSV files.")}
            >
              <Code2 size={14} />
              <span>Write a FastAPI endpoint to validate and parse CSV files</span>
            </button>
          </div>
        </div>
      );
    }

    if (mode === 'doc') {
      return (
        <div className="empty-state">
          <div className="empty-header">
            <div className="empty-badge">
              <BookOpen size={20} />
            </div>
            <h2>Document Assistant</h2>
            <p>Upload local PDF, DOCX, or text files to ask grounded questions with exact page references.</p>
          </div>

          <div className="empty-doc-action">
            <button className="primary-doc-btn" onClick={onOpenDocDrawer}>
              <FileText size={15} />
              <span>Attach or Manage Documents</span>
            </button>
          </div>

          <div className="suggested-prompts-list">
            <button
              className="prompt-pill"
              onClick={() => onPromptSuggestion("Summarize the key takeaways and main conclusions from the attached document.")}
            >
              <FileText size={14} />
              <span>Summarize the key takeaways from the attached document</span>
            </button>
            <button
              className="prompt-pill"
              onClick={() => onPromptSuggestion("What are the critical dates, deadlines, or numbers mentioned in the document?")}
            >
              <BookOpen size={14} />
              <span>List critical dates or numbers mentioned in the document</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="empty-state">
        <div className="empty-header">
          <div className="empty-badge">
            <Bot size={20} />
          </div>
          <h2>Local AI Assistant</h2>
          <p>Private, on-device intelligence powered by local models and SQLite memory.</p>
        </div>

        <div className="suggested-prompts-list">
          <button
            className="prompt-pill"
            onClick={() => onPromptSuggestion("What are the advantages of running local AI models on your own machine?")}
          >
            <Sparkles size={14} />
            <span>Advantages of running local AI models on your own hardware</span>
          </button>

          <button
            className="prompt-pill"
            onClick={() => onPromptSuggestion("Summarize the differences between SQLite WAL mode and rollback journal.")}
          >
            <Cpu size={14} />
            <span>SQLite WAL mode vs rollback journal: performance trade-offs</span>
          </button>

          <button
            className="prompt-pill"
            onClick={() => onPromptSuggestion("Help me draft a concise project plan for building an offline-first tool.")}
          >
            <Terminal size={14} />
            <span>Draft a concise project plan for building an offline-first tool</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="chat-window">
      <div className="chat-container">
        {messages.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="messages-list">
            {messages.map((msg, idx) => (
              <Message
                key={msg.id || idx}
                message={msg}
                onSpeakText={onSpeakText}
                isSpeakingThisMessage={speakingMessageId === (msg.id || idx)}
                onStopSpeech={onStopSpeech}
                isLatest={idx === messages.length - 1}
                onRegenerate={onRegenerate}
                disabled={status === 'thinking' || status === 'streaming'}
              />
            ))}

            {/* Streaming active message preview */}
            {status === 'streaming' && streamingContent && (
              <Message
                key="streaming-preview"
                message={{
                  role: 'assistant',
                  content: streamingContent,
                }}
              />
            )}

            {/* Thinking indicator before first token */}
            {status === 'thinking' && !streamingContent && (
              <div className="thinking-indicator">
                <div className="avatar assistant-avatar">
                  <Bot size={16} />
                </div>
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className="thinking-label">Generating local response...</span>
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </main>
  );
}
