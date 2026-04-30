import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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

// Removed READING_TEXT

const AudioRecorder = ({ file, audioUrl, loading, onFileSelect, onAnalyze, questions }) => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
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

  const allQuestions = [];
  if (questions?.core) {
    questions.core.forEach((q) => allQuestions.push({ type: 'core', text: q }));
  }
  if (questions?.variative) {
    questions.variative.forEach((q) => allQuestions.push({ type: 'variative', text: q }));
  }

  const nextQuestion = () => {
    if (currentQuestionIndex < allQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  return (
    <div className="upload-card">
      <div className="reading-passage">
        <h3><i className="fa-solid fa-clipboard-question"></i> {t("speech_analysis.interview.title", { week: questions?.week_number || 1 })}</h3>
        <p className="hint" style={{marginBottom: "15px"}}>{t("speech_analysis.interview.hint")}</p>
        
        <div className="interview-questions" style={{ textAlign: "left", fontSize: "15px" }}>
          {allQuestions.length > 0 && (
            <div className="question-carousel" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "120px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "10px", padding: "20px", marginTop: "10px", overflow: "hidden" }}>
              
              <div 
                onClick={prevQuestion}
                style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", cursor: currentQuestionIndex > 0 ? "pointer" : "default", zIndex: 1 }}
              />
              <div 
                onClick={nextQuestion}
                style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", cursor: currentQuestionIndex < allQuestions.length - 1 ? "pointer" : "default", zIndex: 1 }}
              />

              <button 
                onClick={prevQuestion} 
                disabled={currentQuestionIndex === 0}
                style={{ position: "absolute", left: "10px", background: "none", border: "none", color: currentQuestionIndex === 0 ? "rgba(255,255,255,0.2)" : "#00d2ff", fontSize: "24px", cursor: currentQuestionIndex === 0 ? "default" : "pointer", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              
              <div style={{ textAlign: "center", maxWidth: "80%", zIndex: 0 }}>
                <div style={{ color: allQuestions[currentQuestionIndex].type === 'core' ? "#00d2ff" : "#ff00d2", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", fontWeight: "bold" }}>
                  {t("speech_analysis.interview.questions_label")}
                  &nbsp;({currentQuestionIndex + 1} / {allQuestions.length})
                </div>
                <div style={{ fontSize: "18px", lineHeight: "1.4" }}>
                  {t(allQuestions[currentQuestionIndex].text)}
                </div>
              </div>

              <button 
                onClick={nextQuestion} 
                disabled={currentQuestionIndex === allQuestions.length - 1}
                style={{ position: "absolute", right: "10px", background: "none", border: "none", color: currentQuestionIndex === allQuestions.length - 1 ? "rgba(255,255,255,0.2)" : "#00d2ff", fontSize: "24px", cursor: currentQuestionIndex === allQuestions.length - 1 ? "default" : "pointer", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="audio-recorder">
        {!isRecording && !file && (
          <div className="recorder-idle">
            <button className="record-btn" onClick={startRecording} type="button">
              <span className="record-btn-inner" />
            </button>
            <p className="recorder-hint">{t("speech_analysis.recorder.click_to_start")}</p>
            <p className="hint">{t("speech_analysis.recorder.hint")}</p>
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
              <i className="fa-solid fa-stop"></i> {t("speech_analysis.recorder.stop")}
            </button>
          </div>
        )}

        {!isRecording && file && (
          <div className="recorder-done">
            <div className="file-info show">
              <strong><i className="fa-solid fa-microphone-lines"></i> {file.name}</strong> &nbsp;·&nbsp; {(file.size / (1024 * 1024)).toFixed(2)} MB
            </div>
            {audioUrl && <audio src={audioUrl} controls className="show" />}
            <button className="record-btn record-btn-small" onClick={startRecording} type="button" title={t("speech_analysis.recorder.record_again")}>
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
        <i class="fa-solid fa-magnifying-glass"></i> {t("speech_analysis.analyze_btn")}
      </button>
    </div>
  );
};

export default AudioRecorder;
