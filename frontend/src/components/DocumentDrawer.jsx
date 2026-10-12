import React, { useRef, useState } from 'react';
import { FileText, Upload, Trash2, CheckCircle2, AlertCircle, Loader2, BookOpen, X } from 'lucide-react';

export default function DocumentDrawer({
  documents,
  onUploadDocument,
  onDeleteDocument,
  isOpen,
  onClose,
  isUploading,
  uploadError,
  uploadSuccess,
}) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadDocument(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadDocument(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card doc-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge doc-badge">
              <BookOpen size={22} />
            </div>
            <div>
              <h3>Document Assistant</h3>
              <p>Upload PDF, DOCX, or TXT files for local grounded Q&A.</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Drag and drop upload zone */}
        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''} ${isUploading ? 'uploading' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.docx,.txt,.md"
            onChange={handleFileSelect}
          />
          {isUploading ? (
            <div className="drop-zone-content">
              <Loader2 size={32} className="spin-icon" />
              <p className="primary-text">Parsing and indexing document chunks...</p>
              <span>Extracting text page-by-page</span>
            </div>
          ) : (
            <div className="drop-zone-content">
              <Upload size={32} className="upload-icon" />
              <p className="primary-text">Click to upload or drag & drop</p>
              <span>Supports PDF, DOCX, TXT, MD (Max 25 MB)</span>
            </div>
          )}
        </div>

        {/* Alerts */}
        {uploadSuccess && (
          <div className="toast-success">
            <CheckCircle2 size={16} />
            <span>{uploadSuccess}</span>
          </div>
        )}
        {uploadError && (
          <div className="toast-error">
            <AlertCircle size={16} />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Documents List */}
        <div className="doc-list-section">
          <div className="doc-list-header">
            <h4>Uploaded Documents ({documents.length})</h4>
          </div>

          <div className="doc-scroll-area">
            {documents.length === 0 ? (
              <div className="empty-docs">
                <FileText size={32} />
                <p>No documents uploaded yet.</p>
                <span>Upload a document above to ask questions with exact page references.</span>
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="doc-card">
                  <div className="doc-meta-left">
                    <div className="doc-file-icon">
                      <FileText size={20} />
                    </div>
                    <div className="doc-details">
                      <span className="doc-filename">{doc.filename}</span>
                      <span className="doc-subinfo">
                        {doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'} • {formatFileSize(doc.file_size)}
                      </span>
                      {doc.summary && (
                        <p className="doc-summary-snippet">{doc.summary}</p>
                      )}
                    </div>
                  </div>

                  <button
                    className="delete-doc-btn"
                    onClick={() => onDeleteDocument(doc.id)}
                    title="Remove document"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="primary-modal-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
