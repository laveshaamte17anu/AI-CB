import React from 'react';
import { Mic, Square } from 'lucide-react';

export default function MicButton({ isRecording, onStart, onStop, disabled }) {
  return (
    <button
      type="button"
      className={`mic-button ${isRecording ? 'recording' : ''}`}
      onClick={isRecording ? onStop : onStart}
      disabled={disabled}
      title={isRecording ? 'Stop Recording' : 'Speak via Microphone'}
      aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
    >
      {isRecording ? <Square size={20} className="icon-stop" /> : <Mic size={22} className="icon-mic" />}
      {isRecording && <span className="mic-pulse-ring"></span>}
    </button>
  );
}
