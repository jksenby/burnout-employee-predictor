import React, { useState, useRef } from 'react';
import './App.css';

const API_URL = 'http://localhost:8000/predict';

function App() {
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [view, setView] = useState('audio'); // 'audio' | 'mbi'

  const fileInputRef = useRef(null);

  // --- Helpers for formatting ---
  const formatFloat = (v) => (v != null ? Number(v).toFixed(4) : '—');
  const formatHz = (v) => (v != null ? `${Number(v).toFixed(1)} Hz` : '—');
  const formatDb = (v) => (v != null ? `${Number(v).toFixed(1)} dB` : '—');
  const formatRate = (v) => (v != null ? `${Number(v).toFixed(1)} /s` : '—');
  const formatPercent = (v) => (v != null ? `${(Number(v) * 100).toFixed(1)}%` : '—');
  const capitalize = (str) => (!str ? '—' : str.charAt(0).toUpperCase() + str.slice(1));
  const emotionIcon = (name) => {
    const icons = { angry: '😠', happy: '😊', sad: '😢', neutral: '😐' };
    return icons[name] || '🔵';
  };
  const formatSentiment = (v) => {
    if (v == null) return '—';
    const n = Number(v);
    const label = n > 0.05 ? '😊 Positive' : n < -0.05 ? '😔 Negative' : '😐 Neutral';
    return `${label} (${n.toFixed(2)})`;
  };

  // --- Event Handlers ---
  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    
    // Create audio URL
    const url = URL.createObjectURL(selectedFile);
    setAudioUrl(url);
    
    // Reset results
    setData(null);
  };

  const onUploadClick = () => {
    fileInputRef.current.click();
  };

  const onFileChange = (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
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
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    setData(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Analysis failed');
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error:', error);
      alert(`Error analyzing audio: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- Rendering Helpers ---
  const MetricRow = ({ name, value }) => (
    <div className="metric-row">
      <span className="metric-name">{name}</span>
      <span className="metric-value">{value}</span>
    </div>
  );

  const renderResults = () => {
    if (!data) return null;

    const {
      label, score, confidence, probabilities,
      stream_contributions, emotions, dominant_emotion,
      text_analysis, transcript, acoustic_features, model_type
    } = data;

    let riskClass = 'low';
    if (label.includes('Medium')) riskClass = 'medium';
    if (label.includes('High')) riskClass = 'high';

    const scorePercent = (score * 100).toFixed(0);
    const confPercent = (confidence * 100).toFixed(1);

    // Prepare stream data
    const streamConfig = [
      { key: 'hubert_acoustic', label: 'HuBERT Acoustic', cls: 'hubert' },
      { key: 'emotion', label: 'Emotion (SER)', cls: 'emotion' },
      { key: 'wavlm_prosody', label: 'WavLM Prosody', cls: 'wavlm' },
      { key: 'whisper_linguistic', label: 'Whisper Linguistic', cls: 'linguistic' },
    ];

    return (
      <div className="results-container show">
        <div className={`risk-card ${riskClass}`}>
          <div className="risk-label">{label}</div>
          <div className="risk-meta">
            <div className="risk-meta-item">Risk Score: <span>{scorePercent}/100</span></div>
            <div className="risk-meta-item">Confidence: <span>{confPercent}%</span></div>
            <div className="risk-meta-item">Dominant Emotion: <span>{capitalize(dominant_emotion || '—')}</span></div>
          </div>
          <div className="risk-bar">
            <div className="risk-bar-fill" style={{ width: `${scorePercent}%` }}></div>
          </div>
          
          <div className="prob-container">
            {probabilities && Object.entries(probabilities).map(([level, prob], i) => {
               const cls = ['low-prob', 'med-prob', 'high-prob'][i] || '';
               return (
                 <div key={level} className={`prob-item ${cls}`}>
                   <div className="prob-label">{level}</div>
                   <div className="prob-value">{(prob * 100).toFixed(1)}%</div>
                 </div>
               );
            })}
          </div>
          
          <div className="model-badge">
            <span>{model_type === 'trained_gradient_boosting' ? 'TRAINED MODEL' : 'HEURISTIC FALLBACK'}</span>
          </div>
        </div>

        <div className="panels-grid">
          <div className="panel acoustic">
            <div className="panel-header">
              <span className="panel-icon">🔊</span>
              <span className="panel-title">Acoustic Analysis</span>
            </div>
            <div>
              <MetricRow name="Pitch Mean" value={formatHz(acoustic_features?.pitch_mean)} />
              <MetricRow name="Pitch Std" value={formatHz(acoustic_features?.pitch_std)} />
              <MetricRow name="Pitch Range" value={formatHz(acoustic_features?.pitch_range)} />
              <MetricRow name="Energy Mean" value={formatFloat(acoustic_features?.energy_mean)} />
              <MetricRow name="Jitter" value={formatFloat(acoustic_features?.jitter)} />
              <MetricRow name="Shimmer" value={formatFloat(acoustic_features?.shimmer)} />
              <MetricRow name="HNR" value={formatDb(acoustic_features?.hnr)} />
              <MetricRow name="Speech Rate" value={formatRate(acoustic_features?.speech_rate)} />
              <MetricRow name="Pause Ratio" value={formatPercent(acoustic_features?.pause_ratio)} />
            </div>
          </div>

          <div className="panel emotion">
            <div className="panel-header">
              <span className="panel-icon">😶</span>
              <span className="panel-title">Emotion Analysis</span>
            </div>
            <div>
              {['angry', 'happy', 'sad', 'neutral'].map(name => {
                const val = emotions?.[name] || 0;
                const pct = (val * 100).toFixed(1);
                return (
                  <div key={name} className="emotion-bar-container">
                    <div className="emotion-bar-label">
                      <span className="name">{emotionIcon(name)} {capitalize(name)}</span>
                      <span className="value">{pct}%</span>
                    </div>
                    <div className="emotion-bar">
                      <div className={`emotion-bar-fill ${name}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel linguistic">
            <div className="panel-header">
              <span className="panel-icon">📝</span>
              <span className="panel-title">Linguistic Analysis</span>
            </div>
            <div>
              <MetricRow name="Sentiment" value={formatSentiment(text_analysis?.sentiment_polarity)} />
              <MetricRow name="Subjectivity" value={formatPercent(text_analysis?.sentiment_subjectivity)} />
              <MetricRow name="Absolutist Index" value={formatPercent(text_analysis?.absolutist_index)} />
              <MetricRow name="1st Person Ratio" value={formatPercent(text_analysis?.first_person_ratio)} />
              <MetricRow name="Negative Words" value={formatPercent(text_analysis?.negative_word_ratio)} />
              <MetricRow name="Hedging Ratio" value={formatPercent(text_analysis?.hedging_ratio)} />
              <MetricRow name="Word Count" value={text_analysis?.word_count || 0} />
              <MetricRow name="Avg Word Length" value={formatFloat(text_analysis?.avg_word_length)} />
            </div>
          </div>

          <div className="panel stream">
            <div className="panel-header">
              <span className="panel-icon">📊</span>
              <span className="panel-title">Stream Contributions</span>
            </div>
            <div>
              {streamConfig.map(s => {
                const val = stream_contributions?.[s.key] || 0;
                return (
                  <div key={s.key} className="stream-bar-container">
                    <div className="stream-bar-label">
                      <span className="name">{s.label}</span>
                      <span className="value">{val.toFixed(1)}%</span>
                    </div>
                    <div className="stream-bar">
                      <div className={`stream-bar-fill ${s.cls}`} style={{ width: `${val}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="transcript-panel">
          <div className="panel-header">
            <span className="panel-icon">💬</span>
            <span className="panel-title" style={{ color: '#67e8f9' }}>Whisper Transcript</span>
          </div>
          <div className="transcript-text">{transcript || '—'}</div>
        </div>
      </div>
    );
  };

  const renderMBI = () => (
    <div className="mbi-container">
      <div className="mbi-intro">
        <p>Please read each statement carefully and decide if you ever feel this way about your job.</p>
        <p className="subtitle">Select the number that best describes how frequently you feel that way.</p>
      </div>

      <div className="mbi-scale-legend">
        <div><strong>0</strong><br/>Never</div>
        <div><strong>1</strong><br/>A few times a year</div>
        <div><strong>2</strong><br/>Once a month</div>
        <div><strong>3</strong><br/>A few times a month</div>
        <div><strong>4</strong><br/>Once a week</div>
        <div><strong>5</strong><br/>A few times a week</div>
        <div><strong>6</strong><br/>Every day</div>
      </div>

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="mbi-question-item">
          <div className="mbi-question-text">Your Gender</div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <label style={{ color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '14px' }}>
              <input type="radio" name="gender" value="male" style={{ marginRight: '8px', width: '16px', height: '16px', accentColor: '#7c5cfc' }} /> Male
            </label>
            <label style={{ color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '14px' }}>
              <input type="radio" name="gender" value="female" style={{ marginRight: '8px', width: '16px', height: '16px', accentColor: '#7c5cfc' }} /> Female
            </label>
          </div>
        </div>
        {[
          "I feel emotionally drained from my work.",
          "I feel used up at the end of the workday.",
          "I feel fatigued when I get up in the morning and have to face another day on the job.",
          "I can easily understand how my recipients feel about things.",
          "I feel I treat some recipients as if they were impersonal objects.",
          "Working with people all day is really a strain for me.",
          "I deal very effectively with the problems of my recipients.",
          "I feel burned out from my work.",
          "I feel I'm positively influencing other people's lives through my work.",
          "I've become more callous toward people since I took this job.",
          "I worry that this job is hardening me emotionally.",
          "I feel very energetic.",
          "I feel frustrated by my job.",
          "I feel I'm working too hard on my job.",
          "I don't really care what happens to some recipients.",
          "Working with people directly puts too much stress on me.",
          "I can easily create a relaxed atmosphere with my recipients.",
          "I feel exhilarated after working closely with my recipients.",
          "I have accomplished many worthwhile things in this job.",
          "I feel like I'm at the end of my rope.",
          "In my work, I deal with emotional problems very calmly.",
          "I feel that recipients blame me for some of their problems."
        ].map((q, idx) => (
          <div key={idx} className="mbi-question-item">
            <div className="mbi-question-text">{idx + 1}. {q}</div>
            <div className="mbi-options">
              {[0, 1, 2, 3, 4, 5, 6].map((val) => (
                <div key={val} className="mbi-option">
                  <input type="radio" name={`q${idx}`} value={val} />
                  <label>{val}</label>
                </div>
              ))}
            </div>
          </div>
        ))}
        <button className="button" style={{ marginTop: '20px' }}>Submit Assessment</button>
      </form>
    </div>
  );

  return (
    <div className="container">
      <div className="app-header">
        <h1>Employee Burnout Predictor</h1>
        
        {view === 'audio' ? (
          <>
            <p className="subtitle">Multimodal speech analysis with late-fusion architecture</p>
            <div className="streams-badge">
              <span className="stream-chip hubert">🧠 HuBERT — Acoustics</span>
              <span className="stream-chip wavlm">🔊 WavLM — Prosody</span>
              <span className="stream-chip whisper">💬 Whisper — Semantics</span>
            </div>
          </>
        ) : (
          <p className="subtitle">Maslach Burnout Inventory (MBI) — Self-Assessment</p>
        )}
      </div>

      <div className="nav-tabs">
        <button className={`nav-tab ${view === 'audio' ? 'active' : ''}`} onClick={() => setView('audio')}>🎙️ Speech Analysis</button>
        <button className={`nav-tab ${view === 'mbi' ? 'active' : ''}`} onClick={() => setView('mbi')}>📋 MBI Questionnaire</button>
      </div>

      {view === 'audio' ? (
      <>
        <div className="upload-card">
        <div
          className={`upload-area ${isDragOver ? 'dragover' : ''}`}
          onClick={onUploadClick}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className="upload-icon">🎙️</div>
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
            <strong>📄 {file.name}</strong> &nbsp;·&nbsp; {(file.size / (1024 * 1024)).toFixed(2)} MB &nbsp;·&nbsp; {file.type || 'audio'}
          </div>
        )}

        {audioUrl && (
          <audio src={audioUrl} controls className="show" />
        )}

        <button
          className="button"
          disabled={!file || loading}
          onClick={handleAnalyze}
        >
          🔍 Analyze Speech
        </button>
      </div>

      {loading && (
        <div className="loading show">
          <div className="spinner"></div>
          <p>Running multimodal analysis...</p>
          <div className="step-indicator">
            Processing through HuBERT → WavLM → Whisper pipeline
          </div>
        </div>
      )}

        {renderResults()}
      </>
      ) : renderMBI()}
      
    </div>
  );
}

export default App;