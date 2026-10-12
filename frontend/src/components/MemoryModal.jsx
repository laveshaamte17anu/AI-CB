import React, { useState } from 'react';
import { Brain, Plus, Trash2, ToggleLeft, ToggleRight, X, Shield, Info, Check } from 'lucide-react';

export default function MemoryModal({
  isOpen,
  onClose,
  memories,
  onAddMemory,
  onToggleMemory,
  onDeleteMemory,
  onClearMemories,
}) {
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('fact');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [addedToast, setAddedToast] = useState(false);

  if (!isOpen) return null;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    await onAddMemory(newContent.trim(), newCategory);
    setNewContent('');
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card memory-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Brain size={22} />
            </div>
            <div>
              <h3>Assistant Memory & Preferences</h3>
              <p>Preferences and facts saved 100% locally in your SQLite database.</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Privacy Assurance Notice */}
        <div className="memory-privacy-banner">
          <Shield size={16} />
          <span>
            These memories guide local AI responses. No data is ever sent to external cloud servers.
          </span>
        </div>

        {/* Add Memory Form */}
        <form onSubmit={handleAdd} className="add-memory-form">
          <div className="input-group">
            <input
              type="text"
              placeholder="e.g., 'I prefer Python for backend tasks' or 'Always give brief answers'"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="category-select"
            >
              <option value="fact">Fact</option>
              <option value="preference">Preference</option>
              <option value="instruction">Instruction</option>
            </select>
          </div>
          <button type="submit" className="add-memory-btn" disabled={!newContent.trim()}>
            <Plus size={16} />
            <span>Add Memory</span>
          </button>
        </form>

        {addedToast && (
          <div className="toast-success">
            <Check size={14} /> Memory saved successfully!
          </div>
        )}

        {/* Memories List */}
        <div className="memories-list-section">
          <div className="memories-list-header">
            <h4>Saved Memories ({memories.length})</h4>
            {memories.length > 0 && (
              showClearConfirm ? (
                <div className="clear-confirm-group">
                  <span>Confirm clear all?</span>
                  <button
                    className="danger-btn-small"
                    onClick={() => {
                      onClearMemories();
                      setShowClearConfirm(false);
                    }}
                  >
                    Yes, Clear
                  </button>
                  <button
                    className="ghost-btn-small"
                    onClick={() => setShowClearConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="clear-all-btn"
                  onClick={() => setShowClearConfirm(true)}
                >
                  <Trash2 size={13} />
                  <span>Clear All</span>
                </button>
              )
            )}
          </div>

          <div className="memories-scroll-area">
            {memories.length === 0 ? (
              <div className="empty-memories">
                <Info size={28} />
                <p>No saved memories yet.</p>
                <span>Add facts or instructions above to personalize your assistant.</span>
              </div>
            ) : (
              memories.map((m) => (
                <div key={m.id} className={`memory-card ${!m.is_active ? 'inactive' : ''}`}>
                  <div className="memory-content-box">
                    <span className={`category-tag ${m.category}`}>
                      {m.category || 'fact'}
                    </span>
                    <p className="memory-text">{m.content}</p>
                  </div>

                  <div className="memory-card-actions">
                    <button
                      className="toggle-active-btn"
                      onClick={() => onToggleMemory(m.id, !m.is_active)}
                      title={m.is_active ? "Disable memory" : "Enable memory"}
                    >
                      {m.is_active ? (
                        <ToggleRight size={22} className="toggle-on" />
                      ) : (
                        <ToggleLeft size={22} className="toggle-off" />
                      )}
                    </button>
                    <button
                      className="delete-mem-btn"
                      onClick={() => onDeleteMemory(m.id)}
                      title="Delete memory"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="primary-modal-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
