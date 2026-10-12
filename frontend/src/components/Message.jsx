import React from 'react';
import { User, Bot } from 'lucide-react';

export default function Message({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
      <div className="avatar">
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>
      <div className="message-content">
        <div className="sender-label">{isUser ? 'You' : 'AI Assistant'}</div>
        <div className="message-bubble">{message.content}</div>
      </div>
    </div>
  );
}
