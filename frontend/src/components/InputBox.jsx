import React, { useRef, useEffect } from 'react';
import {
  Send,
  Square,
  Volume2,
  VolumeX,
  Trash2,
  FileText,
  Code2,
  Sparkles,
  Bug,
  RefreshCw
} from 'lucide-react';
import MicButton from './MicButton';

export default function InputBox({
  text,
  onTextChange,
  onSendMessage,
  isRecording,
  onStartRecord,
  onStopRecord,
  voiceEnabled,
  onToggleVoice,
  onClearChat,
  disabled,
  isStreaming,
  onStopStreaming,
  mode = 'chat',
  onOpenDocDrawer,
  hasDocuments,
}) {
  const textareaRef = useRef(null);

  // Auto-resize textarea smoothly
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 160)}px`;
    }
  }, [text]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isStreaming) {
      onStopStreaming();
      return;
    }
    if (!text || !text.trim() || disabled) return;
    onSendMessage(text.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleQuickCodingPrefix = (prefix) => {
    onTextChange(`${prefix}: \n` + (text || ''));
    textareaRef.current?.focus();
  };

  const getPlaceholder = () => {
    if (isRecording) {
      return 'Recording audio... Speak now, click stop or press Enter when finished.';
    }
    if (mode === 'code') {
      return 'Ask a coding question, debug stack trace, or paste code... (Shift+Enter for newline)';
    }
    if (mode === 'doc') {
      return 'Ask a grounded question about your uploaded documents...';
    }
    return 'Ask anything, or click microphone to dictate... (Enter to send)';
  };

  return (
    <footer className="input-area-container">
      <div className="composer-wrapper">
        {/* Coding Quick Actions Bar (Visible in Code Mode) */}
        {mode === 'code' && (
          <div className="coding-quick-actions">
            <span className="quick-label"><Code2 size={13} /> Quick tools:</span>
            <button
              type="button"
              className="quick-chip"
              onClick={() => handleQuickCodingPrefix("Explain this code step-by-step")}
            >
              <Sparkles size={12} /> Explain
            </button>
            <button
              type="button"
              className="quick-chip"
              onClick={() => handleQuickCodingPrefix("Debug this error and provide fix")}
            >
              <Bug size={12} /> Debug
            </button>
            <button
              type="button"
              className="quick-chip"
              onClick={() => handleQuickCodingPrefix("Refactor this code for readability and efficiency")}
            >
              <RefreshCw size={12} /> Refactor
            </button>
            <button
              type="button"
              className="quick-chip"
              onClick={() => handleQuickCodingPrefix("Review this code for edge cases and security risks")}
            >
              Review
            </button>
          </div>
        )}

        <form className="composer-card" onSubmit={handleSubmit}>
          {/* Main Textarea */}
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder={getPlaceholder()}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled}
          />

          {/* Action Row Inside Composer */}
          <div className="composer-action-bar">
            <div className="composer-tools-left">
              <button
                type="button"
                className={`tool-btn doc-tool-btn ${hasDocuments ? 'has-docs' : ''}`}
                onClick={onOpenDocDrawer}
                title={hasDocuments ? "Manage attached documents" : "Attach PDF/Document"}
              >
                <FileText size={15} />
                <span>{hasDocuments ? "Docs attached" : "Attach doc"}</span>
              </button>

              <MicButton
                isRecording={isRecording}
                onStart={onStartRecord}
                onStop={onStopRecord}
                disabled={disabled || isStreaming}
              />
            </div>

            <div className="composer-tools-right">
              <button
                type="button"
                className={`tool-btn voice-toggle-btn ${voiceEnabled ? 'active' : ''}`}
                onClick={onToggleVoice}
                title={voiceEnabled ? "Disable voice read-aloud" : "Enable voice read-aloud"}
              >
                {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span>Voice TTS</span>
              </button>

              <button
                type="button"
                className="tool-btn icon-only-btn"
                onClick={onClearChat}
                disabled={disabled || isStreaming}
                title="Clear conversation"
              >
                <Trash2 size={14} />
              </button>

              {isStreaming ? (
                <button
                  type="button"
                  className="send-btn stop-state"
                  onClick={onStopStreaming}
                  title="Stop generating"
                >
                  <Square size={13} />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="send-btn"
                  disabled={!text || !text.trim() || disabled || isRecording}
                  title="Send message (Enter)"
                >
                  <Send size={14} />
                  <span>Send</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </footer>
  );
}
