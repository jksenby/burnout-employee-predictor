import React, { useState, useRef, useCallback, useEffect } from 'react';

// Encode an AudioBuffer into a WAV Blob
function audioBufferToWav(buffer) {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataLength = samples.length * 2;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// Convert any audio Blob to WAV using Web Audio API
async function convertToWav(blob) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  audioContext.close();
  return audioBufferToWav(audioBuffer);
}

const AudioRecorder = ({ file, audioUrl, loading, onFileSelect, onAnalyze }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const webmBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

        // Convert webm → WAV so the backend (soundfile) can read it
        const wavBlob = await convertToWav(webmBlob);
        const recordedFile = new File(
          [wavBlob],
          `recording_${Date.now()}.wav`,
          { type: 'audio/wav' }
        );
        onFileSelect(recordedFile);

        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      mediaRecorder.start(250); // collect data every 250ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access is required to record audio.');
    }
  }, [onFileSelect]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="upload-card">
      <div className="audio-recorder">
        {!isRecording && !file && (
          <div className="recorder-idle">
            <button className="record-btn" onClick={startRecording} type="button">
              <span className="record-btn-inner" />
            </button>
            <p className="recorder-hint">Click to start recording</p>
            <p className="hint">WAV, MP3, FLAC — 5-60 seconds of speech</p>
          </div>
        )}

        {isRecording && (
          <div className="recorder-active">
            <div className="waveform-bars">
              {[...Array(9)].map((_, i) => (
                <span key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.08}s` }} />
              ))}
            </div>
            <div className="recording-indicator">
              <span className="rec-dot" />
              <span className="rec-timer">{formatTime(elapsed)}</span>
            </div>
            <button className="stop-btn" onClick={stopRecording} type="button">
              <i className="fa-solid fa-stop"></i> Stop Recording
            </button>
          </div>
        )}

        {!isRecording && file && (
          <div className="recorder-done">
            <div className="file-info show">
              <strong><i className="fa-solid fa-microphone-lines"></i> {file.name}</strong> &nbsp;·&nbsp; {(file.size / (1024 * 1024)).toFixed(2)} MB
            </div>
            {audioUrl && <audio src={audioUrl} controls className="show" />}
            <button className="record-btn record-btn-small" onClick={startRecording} type="button" title="Record again">
              <span className="record-btn-inner" />
            </button>
          </div>
        )}
      </div>

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

export default AudioRecorder;
