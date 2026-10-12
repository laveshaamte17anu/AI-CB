import React from 'react';
import { Mic, Square } from 'lucide-react';

export default function MicButton({ isRecording, onStart, onStop, disabled }) {
  return (
    <button
      type="button"
      className={`tool-btn mic-tool-btn ${isRecording ? 'recording' : ''}`}
      onClick={isRecording ? onStop : onStart}
      disabled={disabled}
      title={isRecording ? 'Stop Recording' : 'Dictate with Microphone'}
      aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
    >
      {isRecording ? <Square size={14} className="icon-stop" /> : <Mic size={14} className="icon-mic" />}
      <span>{isRecording ? 'Stop' : 'Dictate'}</span>
      {isRecording && <span className="recording-live-indicator" />}
    </button>
  );
}
