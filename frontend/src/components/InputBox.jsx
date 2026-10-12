import React from 'react';
import { Send, Volume2, VolumeX, Trash2 } from 'lucide-react';
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
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text || !text.trim() || disabled) return;
    onSendMessage(text.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <footer className="input-area-container">
      <form className="input-bar" onSubmit={handleSubmit}>
        <MicButton
          isRecording={isRecording}
          onStart={onStartRecord}
          onStop={onStopRecord}
          disabled={disabled}
        />

        <textarea
          className="chat-input"
          placeholder={
            isRecording 
              ? '🔴 Listening... Speak now (Marathi / Hindi / English)...' 
              : 'Type your message or click mic to speak... (Enter to send)'
          }
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
        />

        <button
          type="submit"
          className="send-button"
          disabled={!text || !text.trim() || disabled || isRecording}
          title="Send Message"
        >
          <Send size={18} />
        </button>
      </form>

      <div className="toolbar-controls">
        <button
          type="button"
          className={`voice-toggle-btn ${voiceEnabled ? 'active' : ''}`}
          onClick={onToggleVoice}
        >
          {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          <span>{voiceEnabled ? '🔊 Voice ON' : '🔇 Voice OFF'}</span>
        </button>

        <button
          type="button"
          className="clear-btn"
          onClick={onClearChat}
          disabled={disabled}
        >
          <Trash2 size={15} />
          <span>Clear Chat</span>
        </button>
      </div>
    </footer>
  );
}
