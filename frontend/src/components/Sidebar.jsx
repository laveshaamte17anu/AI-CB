import React, { useState } from 'react';
import {
  MessageSquare,
  Code2,
  FileText,
  Plus,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  Brain,
  Cpu,
  ShieldCheck,
  ChevronLeft,
  Database
} from 'lucide-react';

export default function Sidebar({
  conversations,
  currentConvId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  searchQuery,
  onSearchChange,
  activeMode,
  onChangeMode,
  models,
  activeModel,
  onSelectModel,
  onOpenMemoryModal,
  isOpen,
  onToggleSidebar,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const startRename = (conv, e) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = (convId, e) => {
    e?.stopPropagation();
    if (editTitle.trim()) {
      onRenameConversation(convId, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'code':
        return <Code2 size={16} className="mode-icon code-color" />;
      case 'doc':
        return <FileText size={16} className="mode-icon doc-color" />;
      default:
        return <MessageSquare size={16} className="mode-icon chat-color" />;
    }
  };

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div className="sidebar-backdrop" onClick={onToggleSidebar} />
      )}

      <aside className={`app-sidebar ${isOpen ? 'open' : 'collapsed'}`}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="brand-wrapper">
            <div className="brand-logo">
              <ShieldCheck size={20} className="shield-icon" />
            </div>
            <div className="brand-meta">
              <h2>Local AI</h2>
              <span className="privacy-pill">100% Offline</span>
            </div>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={onToggleSidebar}
            title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="mode-tabs">
          <button
            className={`mode-tab ${activeMode === 'chat' ? 'active' : ''}`}
            onClick={() => onChangeMode('chat')}
            title="General Chat Assistant"
          >
            <MessageSquare size={15} />
            <span>Chat</span>
          </button>
          <button
            className={`mode-tab ${activeMode === 'code' ? 'active' : ''}`}
            onClick={() => onChangeMode('code')}
            title="Coding & Engineering Assistant"
          >
            <Code2 size={15} />
            <span>Code</span>
          </button>
          <button
            className={`mode-tab ${activeMode === 'doc' ? 'active' : ''}`}
            onClick={() => onChangeMode('doc')}
            title="Document & PDF Assistant"
          >
            <FileText size={15} />
            <span>Docs</span>
          </button>
        </div>

        {/* New Chat Button */}
        <button
          className="new-chat-btn"
          onClick={() => onNewConversation(activeMode)}
        >
          <Plus size={18} />
          <span>New {activeMode === 'code' ? 'Coding' : activeMode === 'doc' ? 'Doc' : 'Chat'}</span>
        </button>

        {/* Search Conversations */}
        <div className="search-bar">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => onSearchChange('')}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Conversations List */}
        <div className="conversations-list-container">
          <div className="conversations-header">
            <span>Conversations</span>
            <span className="count-pill">{conversations.length}</span>
          </div>

          <div className="conversations-scroll">
            {conversations.length === 0 ? (
              <div className="empty-conversations">
                <p>No conversations found.</p>
                <span>Click "New Chat" to begin.</span>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`conversation-item ${conv.id === currentConvId ? 'active' : ''}`}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <div className="item-icon-wrapper">
                    {getModeIcon(conv.mode)}
                  </div>

                  {editingId === conv.id ? (
                    <div className="inline-rename-box" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(conv.id, e);
                          if (e.key === 'Escape') cancelRename(e);
                        }}
                      />
                      <button className="rename-btn confirm" onClick={(e) => saveRename(conv.id, e)}>
                        <Check size={14} />
                      </button>
                      <button className="rename-btn cancel" onClick={cancelRename}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="conversation-info">
                        <span className="conversation-title">{conv.title}</span>
                        {conv.preview && (
                          <span className="conversation-preview">{conv.preview}</span>
                        )}
                      </div>

                      <div className="item-actions">
                        <button
                          className="action-icon-btn"
                          onClick={(e) => startRename(conv, e)}
                          title="Rename conversation"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className={`action-icon-btn delete ${confirmDeleteId === conv.id ? 'confirming' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirmDeleteId === conv.id) {
                              onDeleteConversation(conv.id);
                              setConfirmDeleteId(null);
                            } else {
                              setConfirmDeleteId(conv.id);
                              setTimeout(() => setConfirmDeleteId(null), 4000);
                            }
                          }}
                          title={confirmDeleteId === conv.id ? "Click again to confirm delete" : "Delete conversation"}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="sidebar-footer">
          {/* Model Switcher */}
          <div className="model-selector-wrapper">
            <div className="selector-label">
              <Cpu size={14} />
              <span>Model</span>
            </div>
            <select
              value={activeModel}
              onChange={(e) => onSelectModel(e.target.value)}
              className="model-dropdown"
            >
              {models && models.length > 0 ? (
                models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))
              ) : (
                <option value={activeModel}>{activeModel}</option>
              )}
            </select>
          </div>

          {/* Memory Management Button */}
          <button
            className="footer-nav-btn memory-nav-btn"
            onClick={onOpenMemoryModal}
          >
            <Brain size={16} />
            <span>Memory & Preferences</span>
          </button>

          {/* Local SQLite Storage indicator */}
          <div className="storage-badge">
            <Database size={13} />
            <span>SQLite Local Storage</span>
          </div>
        </div>
      </aside>
    </>
  );
}
