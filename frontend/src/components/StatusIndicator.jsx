import React from 'react';

export default function StatusIndicator({ status, statusMessage }) {
  // Strip out duplicate unicode bullet characters if present
  const cleanLabel = (statusMessage || 'Local Ready').replace(/^●\s*/, '');

  return (
    <div className={`status-pill status-${status}`}>
      <span className="status-indicator-dot" />
      <span className="status-label">{cleanLabel}</span>
    </div>
  );
}
