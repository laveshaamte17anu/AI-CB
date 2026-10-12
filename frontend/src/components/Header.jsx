import React from 'react';
import { Bot, Cpu } from 'lucide-react';
import StatusIndicator from './StatusIndicator';

export default function Header({ status, statusMessage, activeModel = 'qwen3:4b' }) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="logo-badge">
          <Bot size={26} className="logo-icon" />
        </div>
        <div className="brand-titles">
          <h1>Local AI Assistant</h1>
          <span className="subtitle">
            <Cpu size={14} className="cpu-icon" /> {activeModel} • 100% Local AI
          </span>
        </div>
      </div>
      
      <div className="header-actions">
        <StatusIndicator status={status} statusMessage={statusMessage} />
      </div>
    </header>
  );
}
