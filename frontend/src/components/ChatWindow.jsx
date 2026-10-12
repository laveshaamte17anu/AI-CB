import React, { useEffect, useRef } from 'react';
import { Bot, Mic, Sparkles } from 'lucide-react';
import Message from './Message';

export default function ChatWindow({ messages, status }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  return (
    <main className="chat-window">
      {messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrapper">
            <Bot size={48} className="empty-icon" />
          </div>
          <h2>Local AI Voice Assistant</h2>
          <p>Everything runs 100% locally on your computer.</p>
          <div className="features-chips">
            <span className="chip"><Mic size={14} /> Local Whisper Speech-to-Text</span>
            <span className="chip"><Sparkles size={14} /> Qwen3:4B LLM</span>
          </div>
        </div>
      ) : (
        <div className="messages-list">
          {messages.map((msg, idx) => (
            <Message key={idx} message={msg} />
          ))}
          {status === 'thinking' && (
            <div className="thinking-indicator">
              <div className="avatar assistant-avatar">
                <Bot size={18} />
              </div>
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
        </div>
      )}
      <div ref={bottomRef} />
    </main>
  );
}
