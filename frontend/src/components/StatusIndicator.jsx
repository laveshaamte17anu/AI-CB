import React from 'react';

export default function StatusIndicator({ status, statusMessage }) {
  // Determine CSS class based on current system state
  // States: ready, listening, transcribing, thinking, speaking, error
  return (
    <div className={`status-badge status-${status}`}>
      <span className="status-dot"></span>
      <span className="status-text">{statusMessage}</span>
    </div>
  );
}
