import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  User,
  Bot,
  Copy,
  Check,
  Volume2,
  VolumeX,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileCode,
  RotateCw
} from 'lucide-react';

export default function Message({
  message,
  onSpeakText,
  isSpeakingThisMessage,
  onStopSpeech,
  isLatest,
  onRegenerate,
  disabled,
  isStreaming = false,
}) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sources = message.metadata?.sources || [];

  return (
    <div className={`message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
      <div className="avatar">
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>

      <div className="message-content">
        <div className="message-header-meta">
          <span className="sender-label">{isUser ? 'You' : 'AI Assistant'}</span>
          {message.created_at && (
            <span className="message-time">
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="message-bubble">
          {isUser ? (
            <div className="user-text-content">{message.content}</div>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ _node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeText = String(children).replace(/\n$/, '');

                    if (!inline && match) {
                      return (
                        <div className="code-block-wrapper">
                          <div className="code-block-header">
                            <span className="code-lang-tag">
                              <FileCode size={13} /> {match[1]}
                            </span>
                            <CopyCodeButton textToCopy={codeText} />
                          </div>
                          <pre className="code-pre">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      );
                    }
                    if (!inline) {
                      return (
                        <div className="code-block-wrapper">
                          <div className="code-block-header">
                            <span className="code-lang-tag">Code</span>
                            <CopyCodeButton textToCopy={codeText} />
                          </div>
                          <pre className="code-pre">
                            <code {...props}>{children}</code>
                          </pre>
                        </div>
                      );
                    }
                    return (
                      <code className="inline-code" {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="streaming-cursor" aria-hidden="true" />
              )}
            </div>
          )}

          {/* Document Sources & Citations Accordion */}
          {!isUser && sources.length > 0 && (
            <div className="sources-container">
              <button
                className="sources-toggle-btn"
                onClick={() => setShowSources(!showSources)}
              >
                <BookOpen size={14} />
                <span>Grounding Citations ({sources.length} sources)</span>
                {showSources ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showSources && (
                <div className="sources-list">
                  {sources.map((src, idx) => (
                    <div key={idx} className="source-card">
                      <div className="source-header">
                        <span className="source-doc-name">{src.filename}</span>
                        <span className="source-page-badge">Page {src.page}</span>
                      </div>
                      {src.snippet && (
                        <p className="source-snippet">"{src.snippet}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message Action Toolbar */}
        {!isUser && (
          <div className="message-action-bar">
            <button
              className="msg-action-btn"
              onClick={handleCopy}
              title="Copy response"
            >
              {copied ? <Check size={14} className="copied-icon" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {onSpeakText && (
              <button
                className={`msg-action-btn ${isSpeakingThisMessage ? 'speaking-active' : ''}`}
                onClick={() => {
                  if (isSpeakingThisMessage) onStopSpeech();
                  else onSpeakText(message.content, message.id);
                }}
                title={isSpeakingThisMessage ? 'Stop reading' : 'Read aloud'}
              >
                {isSpeakingThisMessage ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <span>{isSpeakingThisMessage ? 'Stop' : 'Read'}</span>
              </button>
            )}

            {onRegenerate && isLatest && (
              <button
                className={`msg-action-btn ${message.content?.startsWith('⚠️ Error:') ? 'retry-highlight' : ''}`}
                onClick={onRegenerate}
                disabled={disabled}
                title={message.content?.startsWith('⚠️ Error:') ? 'Retry request' : 'Regenerate response'}
              >
                <RotateCw size={14} />
                <span>{message.content?.startsWith('⚠️ Error:') ? 'Retry' : 'Regenerate'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CopyCodeButton({ textToCopy }) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button className="copy-code-btn" onClick={handleCopyCode} title="Copy code snippet">
      {copied ? <Check size={13} /> : <Copy size={13} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
