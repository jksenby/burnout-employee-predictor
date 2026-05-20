import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import './ReportPage.css';

const PALETTE = ['#8884d8', '#82ca9d', '#ff7300', '#e84393', '#00C49F', '#FFBB28', '#FF8042'];
const RISK_COLORS = { 'Low Risk': '#4CAF50', 'Moderate Risk': '#FF9800', 'High Risk': '#f44336' };

const getRiskColor = (score) => {
  if (score === null || score === undefined) return '#aaa';
  if (score < 0.4) return '#4CAF50';
  if (score < 0.65) return '#FF9800';
  return '#f44336';
};

const getRiskLabel = (score, t) => {
  if (score === null || score === undefined) return '—';
  if (score < 0.4) return t('Low Risk', 'Низкий риск');
  if (score < 0.65) return t('Moderate Risk', 'Умеренный риск');
  return t('High Risk', 'Высокий риск');
};

const ReportPage = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [reportData, setReportData] = useState([]);
  const [historyData, setHistoryData] = useState(null);
  const [crossValMessage, setCrossValMessage] = useState(null);
  const [crossValFailed, setCrossValFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [reportRes, historyRes] = await Promise.all([
          fetch('http://localhost:8000/report/data', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('http://localhost:8000/history', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!reportRes.ok) throw new Error('Failed to load report data');
        if (!historyRes.ok) throw new Error('Failed to load history data');

        const reportJson = await reportRes.json();
        const historyJson = await historyRes.json();

        const formattedData = reportJson.data.map(item => ({
          week: `W${item.week_number}`,
          mbi_score: item.mbi_score !== null ? parseFloat(item.mbi_score.toFixed(3)) : null,
          speech_score: item.speech_score !== null ? parseFloat(item.speech_score.toFixed(3)) : null,
          absolutist_index: item.absolutist_index !== null ? parseFloat(item.absolutist_index.toFixed(3)) : null,
          negative_word_ratio: item.negative_word_ratio !== null ? parseFloat(item.negative_word_ratio.toFixed(3)) : null,
          sentiment_polarity: item.sentiment_polarity !== null ? parseFloat(item.sentiment_polarity.toFixed(3)) : null,
          speech_count: item.speech_count,
          mbi_count: item.mbi_count,
        }));

        setReportData(formattedData);
        setCrossValFailed(reportJson.cross_validation_failed);
        setCrossValMessage(reportJson.cross_validation_message);
        setHistoryData(historyJson);
      } catch (err) {
        console.error('Report load error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [token]);

  const summaryStats = useMemo(() => {
    if (!historyData) return null;
    const speeches = historyData.speech_analyses || [];
    const mbis = historyData.mbi_results || [];

    const avgSpeech = speeches.length > 0
      ? speeches.reduce((s, a) => s + a.score, 0) / speeches.length
      : null;
    const latestMbi = mbis.length > 0 ? mbis[0].burnout_index : null;

    const valid = reportData.filter(d => d.speech_score !== null);
    let trend = 'stable';
    if (valid.length >= 4) {
      const mid = Math.floor(valid.length / 2);
      const firstAvg = valid.slice(0, mid).reduce((s, d) => s + d.speech_score, 0) / mid;
      const secondAvg = valid.slice(mid).reduce((s, d) => s + d.speech_score, 0) / (valid.length - mid);
      if (secondAvg - firstAvg > 0.05) trend = 'worsening';
      else if (firstAvg - secondAvg > 0.05) trend = 'improving';
    }

    return { totalSpeech: speeches.length, totalMbi: mbis.length, avgSpeech, latestMbi, trend };
  }, [historyData, reportData]);

  const mbiSubScaleData = useMemo(() => {
    if (!historyData) return [];
    return [...(historyData.mbi_results || [])]
      .reverse()
      .map((m, i) => ({
        label: `MBI ${i + 1}`,
        date: new Date(m.created_at).toLocaleDateString(),
        ee: m.emotional_exhaustion,
        dp: m.depersonalization,
        pa: m.personal_accomplishment,
      }));
  }, [historyData]);

  const riskDistribution = useMemo(() => {
    if (!historyData) return [];
    const counts = {};
    (historyData.speech_analyses || []).forEach(s => {
      counts[s.label] = (counts[s.label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [historyData]);

  const emotionData = useMemo(() => {
    if (!historyData) return [];
    const totals = {};
    const counts = {};
    (historyData.speech_analyses || []).forEach(s => {
      if (s.emotions) {
        Object.entries(s.emotions).forEach(([emotion, val]) => {
          totals[emotion] = (totals[emotion] || 0) + val;
          counts[emotion] = (counts[emotion] || 0) + 1;
        });
      }
    });
    return Object.entries(totals)
      .map(([emotion, total]) => ({
        emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
        avg: parseFloat((total / counts[emotion]).toFixed(3)),
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [historyData]);

  const mbiRadarData = useMemo(() => {
    if (!historyData?.mbi_results?.length) return [];
    const latest = historyData.mbi_results[0];
    return [
      { subject: t('Emot. Exhaustion', 'Эм. истощение'), value: parseFloat(((latest.emotional_exhaustion / 54) * 100).toFixed(1)) },
      { subject: t('Depersonaliz.', 'Деперсонализ.'), value: parseFloat(((latest.depersonalization / 30) * 100).toFixed(1)) },
      { subject: t('Personal Accomp.', 'Личн. достижения'), value: parseFloat(((latest.personal_accomplishment / 48) * 100).toFixed(1)) },
      { subject: t('Reduction', 'Редукция'), value: parseFloat(((latest.reduction_of_achievements / 32) * 100).toFixed(1)) },
    ];
  }, [historyData, t]);

  const speechTrendData = useMemo(() => {
    if (!historyData) return [];
    return [...(historyData.speech_analyses || [])]
      .reverse()
      .map((s, i) => ({
        index: i + 1,
        date: new Date(s.created_at).toLocaleDateString(),
        score: parseFloat(s.score.toFixed(3)),
        confidence: parseFloat(s.confidence.toFixed(3)),
      }));
  }, [historyData]);

  const handleDownloadPdf = async () => {
    try {
      const response = await fetch('http://localhost:8000/report/pdf', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Burnout_Report.pdf');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error(err);
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="report-loading">
        <div className="loading-spinner" />
        <p>{t('Loading report...', 'Загрузка отчёта...')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="report-error">
        <p>⚠ {t('Failed to load report', 'Не удалось загрузить отчёт')}: {error}</p>
      </div>
    );
  }

  const trendInfo = {
    improving: { icon: '↓', label: t('Improving', 'Улучшается'), color: '#4CAF50' },
    worsening: { icon: '↑', label: t('Worsening', 'Ухудшается'), color: '#f44336' },
    stable: { icon: '→', label: t('Stable', 'Стабильно'), color: '#FF9800' },
  };
  const trend = summaryStats?.trend || 'stable';

  return (
    <div className="report-container">

      {/* ── Header ── */}
      <div className="report-header">
        <div>
          <h1 className="report-title">{t('Burnout Assessment Report', 'Отчёт об оценке выгорания')}</h1>
          <p className="report-subtitle">{t('8-Week Progress Overview', 'Обзор динамики за 8 недель')} · {new Date().toLocaleDateString()}</p>
        </div>
        <button className="download-btn no-print" onClick={handleDownloadPdf}>
          ⬇ {t('Download PDF', 'Скачать PDF')}
        </button>
      </div>

      {/* ── Cross-validation warning ── */}
      {crossValFailed && (
        <div className="cross-val-warning">
          <span className="warning-icon">⚠</span>
          <div>
            <strong>{t('Warning', 'Внимание')}:</strong> {crossValMessage}
          </div>
        </div>
      )}

      {/* ── Summary cards ── */}
      {summaryStats && (
        <div className="summary-cards">
          <div className="stat-card">
            <div className="stat-label">{t('Avg. Acoustic Risk', 'Ср. акустический риск')}</div>
            <div className="stat-value" style={{ color: getRiskColor(summaryStats.avgSpeech) }}>
              {summaryStats.avgSpeech !== null ? `${(summaryStats.avgSpeech * 100).toFixed(1)}%` : '—'}
            </div>
            <div className="stat-sub">{getRiskLabel(summaryStats.avgSpeech, t)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">{t('Latest MBI Index', 'Последний индекс MBI')}</div>
            <div className="stat-value" style={{ color: getRiskColor(summaryStats.latestMbi) }}>
              {summaryStats.latestMbi !== null ? `${(summaryStats.latestMbi * 100).toFixed(1)}%` : '—'}
            </div>
            <div className="stat-sub">{getRiskLabel(summaryStats.latestMbi, t)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">{t('Speech Sessions', 'Речевых сессий')}</div>
            <div className="stat-value" style={{ color: '#8884d8' }}>{summaryStats.totalSpeech}</div>
            <div className="stat-sub">{t('Total Recorded', 'Всего записей')}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">{t('MBI Tests', 'Тестов MBI')}</div>
            <div className="stat-value" style={{ color: '#82ca9d' }}>{summaryStats.totalMbi}</div>
            <div className="stat-sub">{t('Completed', 'Завершено')}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">{t('Burnout Trend', 'Тенденция')}</div>
            <div className="stat-value trend-value" style={{ color: trendInfo[trend].color }}>
              {trendInfo[trend].icon} {trendInfo[trend].label}
            </div>
            <div className="stat-sub">{t('vs. first half', 'vs. первая половина')}</div>
          </div>
        </div>
      )}

      {/* ── Charts ── */}
      <div className="charts-grid">

        {/* 1. Burnout Risk Area Chart */}
        <div className="chart-card chart-card--wide">
          <h2 className="chart-title">{t('Burnout Risk Index Over Time', 'Индекс риска выгорания по неделям')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={reportData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSpeech" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradMbi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#82ca9d" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `${(v * 100).toFixed(1)}%`} />
              <Legend />
              <Area type="monotone" dataKey="speech_score" name={t('Acoustic Score', 'Акустика')} stroke="#8884d8" fill="url(#gradSpeech)" strokeWidth={2} connectNulls dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Area type="monotone" dataKey="mbi_score" name={t('MBI Score', 'MBI')} stroke="#82ca9d" fill="url(#gradMbi)" strokeWidth={2} connectNulls dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 2. Linguistic Features */}
        <div className="chart-card chart-card--wide">
          <h2 className="chart-title">{t('Linguistic & Semantic Features', 'Лингвистические и семантические признаки')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={reportData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis domain={[-1, 1]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="absolutist_index" name={t('Absolutist Index', 'Индекс абсолютизма')} stroke="#ff7300" strokeWidth={2} connectNulls dot={{ r: 3 }} />
              <Line type="monotone" dataKey="negative_word_ratio" name={t('Neg. Word Ratio', 'Доля негативных слов')} stroke="#f44336" strokeWidth={2} connectNulls dot={{ r: 3 }} />
              <Line type="monotone" dataKey="sentiment_polarity" name={t('Sentiment', 'Тональность')} stroke="#387908" strokeWidth={2} connectNulls dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 3. Individual Speech Score Trend */}
        {speechTrendData.length > 1 && (
          <div className="chart-card chart-card--wide">
            <h2 className="chart-title">🎙 {t('Individual Speech Analysis Trend', 'Динамика каждого речевого анализа')}</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={speechTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="index" tick={{ fontSize: 12 }} label={{ value: t('Session #', 'Сессия №'), position: 'insideBottomRight', offset: -5, fontSize: 11 }} />
                <YAxis domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={i => `${t('Session', 'Сессия')} #${i}`} formatter={(v) => `${(v * 100).toFixed(1)}%`} />
                <Legend />
                <Line type="monotone" dataKey="score" name={t('Burnout Risk Score', 'Риск выгорания')} stroke="#8884d8" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="confidence" name={t('Confidence', 'Уверенность')} stroke="#82ca9d" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 4. MBI Subscales Bar */}
        {mbiSubScaleData.length > 0 && (
          <div className="chart-card">
            <h2 className="chart-title">{t('MBI Subscale Scores', 'Подшкалы MBI по тестам')}</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={mbiSubScaleData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''}
                  formatter={(v, n) => [v, n]}
                />
                <Legend />
                <Bar dataKey="ee" name={t('Emot. Exhaustion', 'Эм. истощение')} fill="#ff7300" radius={[3, 3, 0, 0]} />
                <Bar dataKey="dp" name={t('Depersonalization', 'Деперсонализация')} fill="#8884d8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="pa" name={t('Personal Accomp.', 'Личн. достижения')} fill="#82ca9d" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 5. Emotion Distribution (horizontal bar) */}
        {emotionData.length > 0 && (
          <div className="chart-card">
            <h2 className="chart-title">{t('Avg. Emotion Distribution', 'Среднее распределение эмоций')}</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={emotionData} layout="vertical" margin={{ top: 10, right: 30, left: 90, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="emotion" tick={{ fontSize: 12 }} width={85} />
                <Tooltip formatter={(v) => `${(v * 100).toFixed(1)}%`} />
                <Bar dataKey="avg" name={t('Avg. Score', 'Средний балл')} radius={[0, 4, 4, 0]}>
                  {emotionData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 6. Risk Level Pie */}
        {riskDistribution.length > 0 && (
          <div className="chart-card">
            <h2 className="chart-title">{t('Risk Level Distribution', 'Распределение уровней риска')}</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  innerRadius={40}
                  dataKey="value"
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {riskDistribution.map((entry, i) => (
                    <Cell key={i} fill={RISK_COLORS[entry.name] || PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v + ' ' + t('sessions', 'сессий'), n]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 7. MBI Radar */}
        {mbiRadarData.length > 0 && (
          <div className="chart-card">
            <h2 className="chart-title">{t('MBI Profile (Latest Test)', 'Профиль MBI (последний тест)')}</h2>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={mbiRadarData} outerRadius={90}>
                <PolarGrid stroke="#e0e0e0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
                <Radar name={t('Score (%)', 'Балл (%)')} dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.45} />
                <Tooltip formatter={(v) => [`${v}%`]} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 8. Weekly Activity */}
        <div className="chart-card">
          <h2 className="chart-title">{t('Weekly Activity', 'Активность по неделям')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={reportData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="speech_count" name={t('Speech Analyses', 'Речевых анализов')} fill="#8884d8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="mbi_count" name={t('MBI Tests', 'Тестов MBI')} fill="#82ca9d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* ── Footer ── */}
      <div className="report-footer">
        <p>{t('Generated by Burnout Predictor System', 'Сгенерировано системой Burnout Predictor')}</p>
        <p>{new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
};

export default ReportPage;
