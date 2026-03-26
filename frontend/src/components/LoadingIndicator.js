import React from 'react';

const LoadingIndicator = () => (
  <div className="loading show">
    <div className="spinner"></div>
    <p>Running multimodal analysis...</p>
    <div className="step-indicator">
      Processing through HuBERT → WavLM → Whisper pipeline
    </div>
  </div>
);

export default LoadingIndicator;
