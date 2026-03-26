import React from 'react';
import MetricRow from './MetricRow';
import {
  formatFloat, formatHz, formatDb, formatRate,
  formatPercent, capitalize, emotionIcon, formatSentiment
} from '../helpers/formatters';

const STREAM_CONFIG = [
  { key: 'hubert_acoustic', label: 'HuBERT Acoustic', cls: 'hubert' },
  { key: 'emotion', label: 'Emotion (SER)', cls: 'emotion' },
  { key: 'wavlm_prosody', label: 'WavLM Prosody', cls: 'wavlm' },
  { key: 'whisper_linguistic', label: 'Whisper Linguistic', cls: 'linguistic' },
];

const ResultsPanel = ({ data }) => {
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
            {STREAM_CONFIG.map(s => {
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

export default ResultsPanel;
