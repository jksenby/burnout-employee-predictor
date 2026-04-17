import React, { useRef } from 'react';

const AudioUpload = ({ file, audioUrl, loading, onFileSelect, onAnalyze }) => {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = React.useState(false);

  const onUploadClick = () => {
    fileInputRef.current.click();
  };

  const onFileChange = (e) => {
    if (e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="upload-card">
      <div
        className={`upload-area ${isDragOver ? 'dragover' : ''}`}
        onClick={onUploadClick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="upload-icon"><i className="fa-solid fa-microphone"></i></div>
        <p><strong>Click to upload</strong> or drag & drop</p>
        <p className="hint">WAV, MP3, FLAC — 5-60 seconds of speech</p>
        <input
          type="file"
          ref={fileInputRef}
          accept="audio/*"
          onChange={onFileChange}
        />
      </div>

      {file && (
        <div className="file-info show">
          <strong><i className="fa-solid fa-file-audio"></i> {file.name}</strong> &nbsp;·&nbsp; {(file.size / (1024 * 1024)).toFixed(2)} MB &nbsp;·&nbsp; {file.type || 'audio'}
        </div>
      )}

      {audioUrl && (
        <audio src={audioUrl} controls className="show" />
      )}

      <button
        className="button"
        disabled={!file || loading}
        onClick={onAnalyze}
      >
        <i class="fa-solid fa-magnifying-glass"></i> Analyze Speech
      </button>
    </div>
  );
};

export default AudioUpload;
