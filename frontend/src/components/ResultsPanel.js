import React from 'react';
import { useTranslation } from 'react-i18next';
import MetricRow from './MetricRow';
import {
  formatFloat, formatHz, formatDb, formatRate,
  formatPercent, capitalize, emotionIcon, formatSentiment
} from '../helpers/formatters';

const STREAM_CONFIG = [
  { key: 'hubert_acoustic', label: 'HuBERT Acoustic', cls: 'hubert' },
  { key: 'emotion', label: 'Emotion (SER)', cls: 'emotion' },
  { key: 'wavlm_prosody', label: 'WavLM Prosody', cls: 'wavlm' },
  { key: 'faster_whisper_linguistic', label: 'Faster-Whisper Linguistic', cls: 'linguistic' },
];

const ResultsPanel = ({ data }) => {
  const { t } = useTranslation();
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
        <div className="risk-label">
          {label === "Low Risk" ? t("history.low_risk") : 
           label === "Moderate Risk" ? t("history.moderate_risk") : 
           label === "High Risk" ? t("history.high_risk") : label}
        </div>
        <div className="risk-meta">
          <div className="risk-meta-item">{t("results_panel.risk_score")}: <span>{scorePercent}/100</span></div>
          <div className="risk-meta-item">{t("results_panel.confidence")}: <span>{confPercent}%</span></div>
          <div className="risk-meta-item">{t("results_panel.dominant_emotion")}: <span>{capitalize(dominant_emotion || '—')}</span></div>
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
          <span>{model_type === 'trained_gradient_boosting' ? t("results_panel.trained_model") : t("results_panel.heuristic_fallback")}</span>
        </div>
      </div>

      <div className="panels-grid">
        <div className="panel acoustic">
          <div className="panel-header">
            <span className="panel-icon"><i className="fa-solid fa-volume-high"></i></span>
            <span className="panel-title">{t("results_panel.acoustic_panel")}</span>
          </div>
          <div>
            <MetricRow name={t("results_panel.metrics.pitch_mean")} value={formatHz(acoustic_features?.pitch_mean)} />
            <MetricRow name={t("results_panel.metrics.pitch_std")} value={formatHz(acoustic_features?.pitch_std)} />
            <MetricRow name={t("results_panel.metrics.pitch_range")} value={formatHz(acoustic_features?.pitch_range)} />
            <MetricRow name={t("results_panel.metrics.energy_mean")} value={formatFloat(acoustic_features?.energy_mean)} />
            <MetricRow name={t("results_panel.metrics.jitter")} value={formatFloat(acoustic_features?.jitter)} />
            <MetricRow name={t("results_panel.metrics.shimmer")} value={formatFloat(acoustic_features?.shimmer)} />
            <MetricRow name={t("results_panel.metrics.hnr")} value={formatDb(acoustic_features?.hnr)} />
            <MetricRow name={t("results_panel.metrics.speech_rate")} value={formatRate(acoustic_features?.speech_rate)} />
            <MetricRow name={t("results_panel.metrics.pause_ratio")} value={formatPercent(acoustic_features?.pause_ratio)} />
          </div>
        </div>

        <div className="panel emotion">
          <div className="panel-header">
            <span className="panel-icon"><i className="fa-solid fa-face-meh"></i></span>
            <span className="panel-title">{t("results_panel.emotion_panel")}</span>
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
            <span className="panel-icon"><i className="fa-solid fa-pen-nib"></i></span>
            <span className="panel-title">{t("results_panel.linguistic_panel")}</span>
          </div>
          <div>
            <MetricRow name={t("results_panel.metrics.sentiment")} value={formatSentiment(text_analysis?.sentiment_polarity)} />
            <MetricRow name={t("results_panel.metrics.subjectivity")} value={formatPercent(text_analysis?.sentiment_subjectivity)} />
            <MetricRow name={t("results_panel.metrics.absolutist_index")} value={formatPercent(text_analysis?.absolutist_index)} />
            <MetricRow name={t("results_panel.metrics.first_person_ratio")} value={formatPercent(text_analysis?.first_person_ratio)} />
            <MetricRow name={t("results_panel.metrics.negative_words")} value={formatPercent(text_analysis?.negative_word_ratio)} />
            <MetricRow name={t("results_panel.metrics.hedging_ratio")} value={formatPercent(text_analysis?.hedging_ratio)} />
            <MetricRow name={t("results_panel.metrics.word_count")} value={text_analysis?.word_count || 0} />
            <MetricRow name={t("results_panel.metrics.avg_word_length")} value={formatFloat(text_analysis?.avg_word_length)} />
          </div>
        </div>

        <div className="panel stream">
          <div className="panel-header">
            <span className="panel-icon"><i className="fa-solid fa-chart-pie"></i></span>
            <span className="panel-title">{t("results_panel.stream_contributions")}</span>
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
          <span className="panel-icon"><i className="fa-solid fa-comment-dots"></i></span>
          <span className="panel-title" style={{ color: '#67e8f9' }}>{t("results_panel.transcript_title")}</span>
        </div>
        <div className="transcript-text">{transcript || '—'}</div>
      </div>
    </div>
  );
};

export default ResultsPanel;
