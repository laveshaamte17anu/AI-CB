import React from 'react';
import { Menu, Code2, FileText, MessageSquare, Cpu, Brain } from 'lucide-react';
import StatusIndicator from './StatusIndicator';

export default function Header({
  status,
  statusMessage,
  activeModel = 'qwen2.5:1.5b',
  activeMode = 'chat',
  conversationTitle = 'Local AI Assistant',
  onToggleSidebar,
  onOpenMemoryModal,
  memoryCount = 0,
}) {
  const getModeBadge = () => {
    switch (activeMode) {
      case 'code':
        return (
          <span className="mode-badge code-mode">
            <Code2 size={13} /> Coding Assistant
          </span>
        );
      case 'doc':
        return (
          <span className="mode-badge doc-mode">
            <FileText size={13} /> Document Assistant
          </span>
        );
      default:
        return (
          <span className="mode-badge chat-mode">
            <MessageSquare size={13} /> Chat Mode
          </span>
        );
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          className="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          title="Toggle Conversations Sidebar"
        >
          <Menu size={20} />
        </button>

        <div className="header-title-wrapper">
          <div className="title-row">
            <h1 className="active-conv-title">{conversationTitle || 'Local AI Assistant'}</h1>
            {getModeBadge()}
          </div>
          <div className="header-submeta">
            <span className="model-chip">
              <Cpu size={12} /> {activeModel}
            </span>
            <button
              className="memory-count-chip"
              onClick={onOpenMemoryModal}
              title="Manage saved memories"
            >
              <Brain size={12} /> {memoryCount} {memoryCount === 1 ? 'memory' : 'memories'}
            </button>
          </div>
        </div>
      </div>

      <div className="header-right">
        <StatusIndicator status={status} statusMessage={statusMessage} />
      </div>
    </header>
  );
}
