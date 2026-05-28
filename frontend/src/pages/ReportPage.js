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

const EMOTION_LABELS = {
  joy: 'Радость', happy: 'Радость', happiness: 'Радость',
  sadness: 'Грусть', sad: 'Грусть',
  anger: 'Злость', angry: 'Злость',
  fear: 'Страх', anxious: 'Тревога', anxiety: 'Тревога',
  surprise: 'Удивление', disgust: 'Отвращение', neutral: 'Нейтральность',
};

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

const MetricRow = ({ label, value, note, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, minHeight: 22 }}>
    <span style={{ color: '#6b7280' }}>{label}</span>
    <span style={{ fontWeight: 600, color: color || '#111827' }}>
      {value}
      {note && <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 5, fontWeight: 400 }}>({note})</span>}
    </span>
  </div>
);

const MetricBlock = ({ title, accent, children }) => (
  <div style={{
    background: '#fff',
    borderRadius: 12,
    padding: '18px 20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
    border: '1px solid #f3f4f6',
    borderTop: `3px solid ${accent}`,
  }}>
    <h3 style={{
      margin: '0 0 14px',
      fontSize: 12,
      fontWeight: 700,
      color: accent,
      textTransform: 'uppercase',
      letterSpacing: '0.6px',
    }}>
      {title}
    </h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {children}
    </div>
  </div>
);

const Divider = () => (
  <div style={{ borderTop: '1px solid #f3f4f6', margin: '4px 0' }} />
);

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
          interview_score: item.interview_score !== null ? parseFloat((item.interview_score ?? 0).toFixed(3)) : null,
          reading_score: item.reading_score !== null ? parseFloat((item.reading_score ?? 0).toFixed(3)) : null,
          absolutist_index: item.absolutist_index !== null ? parseFloat(item.absolutist_index.toFixed(3)) : null,
          negative_word_ratio: item.negative_word_ratio !== null ? parseFloat(item.negative_word_ratio.toFixed(3)) : null,
          sentiment_polarity: item.sentiment_polarity !== null ? parseFloat(item.sentiment_polarity.toFixed(3)) : null,
          speech_count: item.speech_count,
          interview_count: item.interview_count ?? 0,
          reading_count: item.reading_count ?? 0,
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

  // ── Verdict: first-vs-last comparison + narrative ──
  const verdictData = useMemo(() => {
    if (!historyData) return null;
    const speeches = historyData.speech_analyses || []; // DESC: index 0 = newest
    const mbis = historyData.mbi_results || [];

    const newestSpeech = speeches[0] || null;
    const oldestSpeech = speeches.length > 1 ? speeches[speeches.length - 1] : null;
    const speechDelta = oldestSpeech && newestSpeech ? newestSpeech.score - oldestSpeech.score : null;
    const speechTrend = speechDelta === null ? 'stable'
      : speechDelta > 0.05 ? 'worsening' : speechDelta < -0.05 ? 'improving' : 'stable';

    const newestMbi = mbis[0] || null;
    const oldestMbi = mbis.length > 1 ? mbis[mbis.length - 1] : null;
    const mbiDelta = oldestMbi && newestMbi ? newestMbi.burnout_index - oldestMbi.burnout_index : null;
    const mbiTrend = mbiDelta === null ? 'stable'
      : mbiDelta > 0.05 ? 'worsening' : mbiDelta < -0.05 ? 'improving' : 'stable';

    let overallTrend = 'stable';
    if (speechTrend === 'worsening' || mbiTrend === 'worsening') overallTrend = 'worsening';
    else if (speechTrend === 'improving' || mbiTrend === 'improving') overallTrend = 'improving';

    const withText = speeches.filter(s => s.text_analysis);
    const avg = (arr, fn) => arr.length > 0 ? arr.reduce((s, x) => s + (fn(x) || 0), 0) / arr.length : null;
    const avgSentiment = avg(withText, s => s.text_analysis.sentiment_polarity);
    const avgAbsolutist = avg(withText, s => s.text_analysis.absolutist_index);
    const avgNegRatio = avg(withText, s => s.text_analysis.negative_word_ratio);

    const emotionTotals = {};
    speeches.forEach(s => s.emotions && Object.entries(s.emotions).forEach(([k, v]) => {
      emotionTotals[k] = (emotionTotals[k] || 0) + v;
    }));
    const topEmotion = Object.entries(emotionTotals).sort((a, b) => b[1] - a[1])[0];
    const dominantEmotion = topEmotion?.[0] || null;
    const dominantEmotionLabel = dominantEmotion ? (EMOTION_LABELS[dominantEmotion] || dominantEmotion) : null;

    const riskCounts = { 'Low Risk': 0, 'Moderate Risk': 0, 'High Risk': 0 };
    speeches.forEach(s => { if (s.label) riskCounts[s.label] = (riskCounts[s.label] || 0) + 1; });

    const withFatigue = speeches.filter(s => s.fatigue_level !== null && s.fatigue_level !== undefined);
    const avgFatigueLevel = withFatigue.length > 0
      ? withFatigue.reduce((s, a) => s + a.fatigue_level, 0) / withFatigue.length : null;

    const stressEventsCount = speeches.filter(s => s.stress_events === true).length;

    const streamKeys = new Set();
    speeches.forEach(s => s.stream_contributions && Object.keys(s.stream_contributions).forEach(k => streamKeys.add(k)));
    const avgStreamContributions = {};
    streamKeys.forEach(key => {
      const vals = speeches.filter(s => s.stream_contributions?.[key] !== undefined);
      if (vals.length > 0)
        avgStreamContributions[key] = vals.reduce((s, a) => s + a.stream_contributions[key], 0) / vals.length;
    });

    const spPct = speechDelta !== null ? Math.abs(speechDelta * 100).toFixed(1) : null;
    const mbPct = mbiDelta !== null ? Math.abs(mbiDelta * 100).toFixed(1) : null;

    let narrative;
    if (speeches.length < 2 && mbis.length < 2) {
      narrative = 'Недостаточно данных для анализа динамики. Пройдите больше сессий, чтобы система могла отследить изменения.';
    } else if (overallTrend === 'improving') {
      if (speechTrend === 'improving' && mbiTrend === 'improving') {
        narrative = `За период наблюдения отмечается устойчивая положительная динамика. Акустический риск снизился на ${spPct}%, индекс MBI уменьшился на ${mbPct}%.`;
      } else if (speechTrend === 'improving') {
        narrative = `Акустические показатели улучшились: риск снизился на ${spPct}% относительно первой записи.${mbiDelta !== null ? ' Показатели MBI остаются стабильными.' : ''}`;
      } else {
        narrative = `Индекс выгорания по MBI снизился на ${mbPct}%.${speechDelta !== null ? ' Акустические показатели остаются стабильными.' : ''}`;
      }
    } else if (overallTrend === 'worsening') {
      if (speechTrend === 'worsening' && mbiTrend === 'worsening') {
        narrative = `За период наблюдения риск выгорания вырос по обоим источникам. Акустический риск увеличился на ${spPct}%, индекс MBI вырос на ${mbPct}%. Рекомендуется обратиться к специалисту.`;
      } else if (speechTrend === 'worsening') {
        narrative = `Акустический риск вырос на ${spPct}% относительно первой записи.${mbiDelta !== null ? ' Показатели MBI в норме.' : ''} Рекомендуется следить за динамикой.`;
      } else {
        narrative = `Индекс выгорания по MBI вырос на ${mbPct}%.${speechDelta !== null ? ' Акустические показатели стабильны.' : ''} Рекомендуется пройти дополнительную оценку.`;
      }
    } else {
      narrative = `Показатели остаются стабильными на протяжении всего периода наблюдения.${speeches.length > 1 || mbis.length > 1 ? ' Значительных изменений не выявлено.' : ''}`;
    }

    if (avgSentiment !== null && avgSentiment < -0.3) {
      narrative += ` Тональность речи выражено негативная (${avgSentiment.toFixed(2)}), что может свидетельствовать о психологическом напряжении.`;
    }

    return {
      overallTrend, speechTrend, mbiTrend,
      speechDelta, mbiDelta,
      newestSpeech, oldestSpeech, newestMbi, oldestMbi,
      avgSentiment, avgAbsolutist, avgNegRatio,
      dominantEmotion, dominantEmotionLabel,
      riskCounts, narrative,
      avgFatigueLevel, stressEventsCount, avgStreamContributions,
    };
  }, [historyData]);

  const currentStateText = useMemo(() => {
    if (!verdictData || !summaryStats) return null;
    const {
      newestSpeech, newestMbi, oldestSpeech, oldestMbi,
      speechDelta, mbiDelta,
      avgSentiment, dominantEmotionLabel, avgFatigueLevel, stressEventsCount,
    } = verdictData;

    const sentences = [];

    // 1. Описание текущего уровня риска простыми словами
    const latestSpeechRisk = newestSpeech?.score ?? null;
    const latestMbiRisk = newestMbi?.burnout_index ?? null;

    if (latestSpeechRisk !== null) {
      if (latestSpeechRisk >= 0.65) {
        sentences.push(
          `Судя по последней записи голоса, прямо сейчас вы находитесь в зоне повышенного риска — ` +
          `система оценивает вероятность выгорания на ${(latestSpeechRisk * 100).toFixed(0)}%. ` +
          `Это значит, что в вашей речи заметны признаки усталости, напряжения или эмоционального истощения.`
        );
      } else if (latestSpeechRisk >= 0.4) {
        sentences.push(
          `По последней записи голоса ваш уровень риска выгорания — умеренный (${(latestSpeechRisk * 100).toFixed(0)}%). ` +
          `Пока всё не критично, но система замечает некоторые признаки усталости в речи — стоит держать это под вниманием.`
        );
      } else {
        sentences.push(
          `По последней записи голоса ситуация выглядит спокойно — риск выгорания низкий (${(latestSpeechRisk * 100).toFixed(0)}%). ` +
          `В речи не обнаружено выраженных признаков усталости или эмоционального истощения.`
        );
      }
    }

    if (latestMbiRisk !== null) {
      if (latestMbiRisk >= 0.65) {
        sentences.push(
          `Тест MBI также подтверждает высокий уровень выгорания (${(latestMbiRisk * 100).toFixed(0)}%): ` +
          `скорее всего, вы чувствуете сильную усталость от работы и эмоциональное опустошение.`
        );
      } else if (latestMbiRisk >= 0.4) {
        sentences.push(
          `По результатам теста MBI выгорание находится на умеренном уровне (${(latestMbiRisk * 100).toFixed(0)}%) — ` +
          `это сигнал, что стоит обратить внимание на баланс работы и отдыха.`
        );
      } else {
        sentences.push(
          `Тест MBI показывает низкий уровень выгорания (${(latestMbiRisk * 100).toFixed(0)}%) — ` +
          `по самооценке вы чувствуете себя достаточно хорошо.`
        );
      }
    }

    // 2. Что изменилось за период
    const hasSpeechChange = speechDelta !== null && Math.abs(speechDelta) > 0.02;
    const hasMbiChange = mbiDelta !== null && Math.abs(mbiDelta) > 0.02;

    if (hasSpeechChange || hasMbiChange) {
      let changeParts = [];
      if (hasSpeechChange) {
        const dir = speechDelta > 0 ? 'вырос' : 'снизился';
        const emoji = speechDelta > 0 ? 'хуже' : 'лучше';
        changeParts.push(
          `речевой риск ${dir} на ${Math.abs(speechDelta * 100).toFixed(1)}% ` +
          `(с ${(oldestSpeech.score * 100).toFixed(0)}% до ${(newestSpeech.score * 100).toFixed(0)}%) — ` +
          `это ${emoji}, чем в начале`
        );
      }
      if (hasMbiChange) {
        const dir = mbiDelta > 0 ? 'вырос' : 'снизился';
        const emoji = mbiDelta > 0 ? 'хуже' : 'лучше';
        changeParts.push(
          `показатель MBI ${dir} на ${Math.abs(mbiDelta * 100).toFixed(1)}% ` +
          `(с ${(oldestMbi.burnout_index * 100).toFixed(0)}% до ${(newestMbi.burnout_index * 100).toFixed(0)}%) — ` +
          `это ${emoji}, чем в начале`
        );
      }
      sentences.push(`За время наблюдения: ${changeParts.join('; ')}.`);
    } else if (speechDelta !== null || mbiDelta !== null) {
      sentences.push('За время наблюдения показатели практически не изменились — ситуация стабильная.');
    } else {
      sentences.push('Пока данных слишком мало для сравнения — пройдите ещё несколько сессий, чтобы увидеть динамику.');
    }

    // 3. Эмоциональный фон
    if (dominantEmotionLabel) {
      const emo = dominantEmotionLabel.toLowerCase();
      sentences.push(
        `Чаще всего в вашей речи система улавливает ${emo} — ` +
        `это наиболее частая эмоция за весь период наблюдений.`
      );
    }

    if (avgSentiment !== null) {
      if (avgSentiment < -0.3) {
        sentences.push(
          'В целом то, как вы говорите, звучит довольно мрачно — в словах много негатива. ' +
          'Это может быть признаком того, что вам сейчас непросто, даже если внешне всё кажется нормальным.'
        );
      } else if (avgSentiment < -0.1) {
        sentences.push('Речь немного окрашена в негативные тона, хотя ничего критичного нет.');
      } else if (avgSentiment > 0.2) {
        sentences.push('Тональность вашей речи в целом позитивная — это хороший знак.');
      } else {
        sentences.push('Тональность речи нейтральная — без явного позитива или негатива.');
      }
    }

    // 4. Усталость и стресс
    if (avgFatigueLevel !== null) {
      if (avgFatigueLevel >= 4) {
        sentences.push(
          `Средний уровень усталости по записям — ${avgFatigueLevel.toFixed(1)} из 5. ` +
          'Это высокий показатель: похоже, вы регулярно приходите на сессии уже довольно уставшим.'
        );
      } else if (avgFatigueLevel >= 3) {
        sentences.push(
          `Средний уровень усталости — ${avgFatigueLevel.toFixed(1)} из 5. ` +
          'Умеренно высоко — стоит следить за режимом отдыха.'
        );
      } else {
        sentences.push(`Уровень усталости в среднем невысокий (${avgFatigueLevel.toFixed(1)} из 5).`);
      }
    }

    if (stressEventsCount > 0 && summaryStats.totalSpeech > 0) {
      const ratio = stressEventsCount / summaryStats.totalSpeech;
      if (ratio > 0.5) {
        sentences.push(
          `В ${stressEventsCount} из ${summaryStats.totalSpeech} сессий система зафиксировала стрессовые паттерны в речи — ` +
          'это больше половины всех записей.'
        );
      } else if (stressEventsCount > 0) {
        sentences.push(
          `В ${stressEventsCount} ${stressEventsCount === 1 ? 'сессии' : 'сессиях'} из ${summaryStats.totalSpeech} были замечены признаки стресса в речи.`
        );
      }
    }

    return sentences.join(' ');
  }, [verdictData, summaryStats]);

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
    improving: { icon: '↓', label: 'Улучшение', color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
    worsening: { icon: '↑', label: 'Ухудшение', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
    stable:    { icon: '→', label: 'Стабильно',  color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  };

  const overallTrend = verdictData?.overallTrend || summaryStats?.trend || 'stable';
  const ti = trendInfo[overallTrend];

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

      {/* ═══════════════════════════════════════════════
          1. ВЕРДИКТ — был ли прогресс или регресс
      ═══════════════════════════════════════════════ */}
      {verdictData && (
        <div style={{
          background: ti.bg,
          border: `2px solid ${ti.border}`,
          borderRadius: 14,
          padding: '22px 26px',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 20,
        }}>
          <div style={{ fontSize: 48, lineHeight: 1, color: ti.color, flexShrink: 0, fontWeight: 300 }}>
            {ti.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ti.color, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
              Итог периода наблюдения
            </div>
            <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 700, color: ti.color }}>
              {ti.label}
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.7, color: '#374151' }}>
              {verdictData.narrative}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {verdictData.speechDelta !== null && (
                <span style={{
                  background: 'rgba(255,255,255,0.85)',
                  border: `1px solid ${trendInfo[verdictData.speechTrend].border}`,
                  borderRadius: 20,
                  padding: '3px 12px',
                  fontSize: 13,
                  color: trendInfo[verdictData.speechTrend].color,
                  fontWeight: 600,
                }}>
                  Речь: {verdictData.speechDelta > 0 ? '+' : ''}{(verdictData.speechDelta * 100).toFixed(1)}%
                </span>
              )}
              {verdictData.mbiDelta !== null && (
                <span style={{
                  background: 'rgba(255,255,255,0.85)',
                  border: `1px solid ${trendInfo[verdictData.mbiTrend].border}`,
                  borderRadius: 20,
                  padding: '3px 12px',
                  fontSize: 13,
                  color: trendInfo[verdictData.mbiTrend].color,
                  fontWeight: 600,
                }}>
                  MBI: {verdictData.mbiDelta > 0 ? '+' : ''}{(verdictData.mbiDelta * 100).toFixed(1)}%
                </span>
              )}
              {verdictData.dominantEmotionLabel && (
                <span style={{
                  background: 'rgba(255,255,255,0.85)',
                  border: '1px solid #e5e7eb',
                  borderRadius: 20,
                  padding: '3px 12px',
                  fontSize: 13,
                  color: '#6b7280',
                }}>
                  Преобл. эмоция: {verdictData.dominantEmotionLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          1b. ТЕКУЩЕЕ СОСТОЯНИЕ — читаемый абзац
      ═══════════════════════════════════════════════ */}
      {currentStateText && (
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderLeft: `4px solid ${ti.color}`,
          borderRadius: 10,
          padding: '18px 22px',
          marginBottom: 28,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>
            Текущее состояние
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: '#1f2937' }}>
            {currentStateText}
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          2. ЦИФРЫ — все показатели из БД
      ═══════════════════════════════════════════════ */}
      {verdictData && summaryStats && (
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>
            Ключевые показатели
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(265px, 1fr))', gap: 16 }}>

            {/* — Речевой анализ — */}
            {historyData.speech_analyses?.length > 0 && (
              <MetricBlock title="Речевой анализ" accent="#8884d8">
                <MetricRow label="Всего сессий" value={summaryStats.totalSpeech} />
                <MetricRow
                  label="Средний риск"
                  value={`${(summaryStats.avgSpeech * 100).toFixed(1)}%`}
                  color={getRiskColor(summaryStats.avgSpeech)}
                  note={getRiskLabel(summaryStats.avgSpeech, t)}
                />
                {verdictData.oldestSpeech && verdictData.newestSpeech && (
                  <MetricRow
                    label="Первая → Последняя"
                    value={`${(verdictData.oldestSpeech.score * 100).toFixed(1)}% → ${(verdictData.newestSpeech.score * 100).toFixed(1)}%`}
                    color={trendInfo[verdictData.speechTrend].color}
                  />
                )}
                {verdictData.avgFatigueLevel !== null && (
                  <MetricRow
                    label="Ср. уровень усталости"
                    value={verdictData.avgFatigueLevel.toFixed(1)}
                    note={`из ${Math.max(...(historyData.speech_analyses || []).filter(s => s.fatigue_level != null).map(s => s.fatigue_level))}`}
                    color={verdictData.avgFatigueLevel >= 4 ? '#dc2626' : verdictData.avgFatigueLevel >= 3 ? '#d97706' : '#16a34a'}
                  />
                )}
                {verdictData.stressEventsCount > 0 && (
                  <MetricRow
                    label="Стрессовых событий"
                    value={`${verdictData.stressEventsCount} из ${summaryStats.totalSpeech}`}
                    color={verdictData.stressEventsCount / summaryStats.totalSpeech > 0.5 ? '#dc2626' : '#d97706'}
                  />
                )}
                <Divider />
                <MetricRow label="Низкий риск" value={`${verdictData.riskCounts['Low Risk']} сес.`} color="#16a34a" />
                <MetricRow label="Умеренный риск" value={`${verdictData.riskCounts['Moderate Risk']} сес.`} color="#d97706" />
                <MetricRow label="Высокий риск" value={`${verdictData.riskCounts['High Risk']} сес.`} color="#dc2626" />
              </MetricBlock>
            )}

            {/* — Тест MBI — */}
            {historyData.mbi_results?.length > 0 && (() => {
              const m = historyData.mbi_results[0];
              const eeColor = m.emotional_exhaustion > 32 ? '#dc2626' : m.emotional_exhaustion > 18 ? '#d97706' : '#16a34a';
              const dpColor = m.depersonalization > 18 ? '#dc2626' : m.depersonalization > 10 ? '#d97706' : '#16a34a';
              const paColor = m.personal_accomplishment < 19 ? '#dc2626' : m.personal_accomplishment < 30 ? '#d97706' : '#16a34a';
              const raColor = m.reduction_of_achievements > 19 ? '#dc2626' : m.reduction_of_achievements > 13 ? '#d97706' : '#16a34a';
              return (
                <MetricBlock title="Тест MBI (последний)" accent="#82ca9d">
                  <MetricRow label="Тестов пройдено" value={summaryStats.totalMbi} />
                  <MetricRow
                    label="Индекс выгорания"
                    value={`${(m.burnout_index * 100).toFixed(1)}%`}
                    color={getRiskColor(m.burnout_index)}
                    note={getRiskLabel(m.burnout_index, t)}
                  />
                  {verdictData.mbiDelta !== null && (
                    <MetricRow
                      label="Первый → Последний"
                      value={`${(verdictData.oldestMbi.burnout_index * 100).toFixed(1)}% → ${(verdictData.newestMbi.burnout_index * 100).toFixed(1)}%`}
                      color={trendInfo[verdictData.mbiTrend].color}
                    />
                  )}
                  <Divider />
                  <MetricRow
                    label="Эмоц. истощение"
                    value={`${m.emotional_exhaustion} / 54`}
                    note={`${((m.emotional_exhaustion / 54) * 100).toFixed(0)}%`}
                    color={eeColor}
                  />
                  <MetricRow
                    label="Деперсонализация"
                    value={`${m.depersonalization} / 30`}
                    note={`${((m.depersonalization / 30) * 100).toFixed(0)}%`}
                    color={dpColor}
                  />
                  <MetricRow
                    label="Личн. достижения"
                    value={`${m.personal_accomplishment} / 48`}
                    note={`${((m.personal_accomplishment / 48) * 100).toFixed(0)}%`}
                    color={paColor}
                  />
                  {m.reduction_of_achievements !== undefined && m.reduction_of_achievements !== null && (
                    <MetricRow
                      label="Редукция достижений"
                      value={`${m.reduction_of_achievements} / 32`}
                      note={`${((m.reduction_of_achievements / 32) * 100).toFixed(0)}%`}
                      color={raColor}
                    />
                  )}
                </MetricBlock>
              );
            })()}

            {/* — Лингвистика — */}
            {verdictData.avgSentiment !== null && (
              <MetricBlock title="Лингвистические признаки" accent="#ff7300">
                <MetricRow
                  label="Тональность речи"
                  value={verdictData.avgSentiment.toFixed(3)}
                  note={verdictData.avgSentiment < -0.2 ? 'негативная' : verdictData.avgSentiment > 0.2 ? 'позитивная' : 'нейтральная'}
                  color={verdictData.avgSentiment < -0.2 ? '#dc2626' : verdictData.avgSentiment > 0.2 ? '#16a34a' : '#d97706'}
                />
                {verdictData.avgAbsolutist !== null && (
                  <MetricRow
                    label="Индекс абсолютизма"
                    value={verdictData.avgAbsolutist.toFixed(3)}
                    note={verdictData.avgAbsolutist > 0.3 ? 'высокий' : verdictData.avgAbsolutist > 0 ? 'умеренный' : 'низкий'}
                    color={verdictData.avgAbsolutist > 0.3 ? '#dc2626' : undefined}
                  />
                )}
                {verdictData.avgNegRatio !== null && (
                  <MetricRow
                    label="Доля негат. слов"
                    value={`${(verdictData.avgNegRatio * 100).toFixed(1)}%`}
                    color={verdictData.avgNegRatio > 0.3 ? '#dc2626' : verdictData.avgNegRatio > 0.15 ? '#d97706' : '#16a34a'}
                  />
                )}
                {verdictData.dominantEmotionLabel && (
                  <MetricRow label="Преобл. эмоция" value={verdictData.dominantEmotionLabel} />
                )}
              </MetricBlock>
            )}

            {/* — Вклад источников — */}
            {Object.keys(verdictData.avgStreamContributions).length > 0 && (
              <MetricBlock title="Вклад источников в оценку" accent="#e84393">
                {Object.entries(verdictData.avgStreamContributions)
                  .sort((a, b) => b[1] - a[1])
                  .map(([key, val]) => (
                    <div key={key}>
                      <MetricRow
                        label={key.charAt(0).toUpperCase() + key.slice(1)}
                        value={`${val.toFixed(1)}%`}
                        color={val > 60 ? '#dc2626' : val > 35 ? '#d97706' : '#6b7280'}
                      />
                      <div style={{
                        height: 4,
                        background: '#f3f4f6',
                        borderRadius: 2,
                        marginTop: 3,
                        marginBottom: 5,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${val.toFixed(1)}%`,
                          background: val > 60 ? '#dc2626' : val > 35 ? '#d97706' : '#8884d8',
                          borderRadius: 2,
                        }} />
                      </div>
                    </div>
                  ))}
              </MetricBlock>
            )}

          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          3. ГРАФИКИ
      ═══════════════════════════════════════════════ */}
      <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>
        Графики
      </h2>
      <div className="charts-grid">

        {/* 1. Burnout Risk Area Chart */}
        <div className="chart-card chart-card--wide">
          <h2 className="chart-title">{t('Burnout Risk Index Over Time', 'Индекс риска выгорания по неделям')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={reportData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradInterview" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradReading" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d2ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d2ff" stopOpacity={0.02} />
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
              <Area type="monotone" dataKey="interview_score" name={t('Interview Score', 'Интервью')} stroke="#8884d8" fill="url(#gradInterview)" strokeWidth={2} connectNulls dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Area type="monotone" dataKey="reading_score" name={t('Reading Score', 'Чтение текста')} stroke="#00d2ff" fill="url(#gradReading)" strokeWidth={2} strokeDasharray="5 3" connectNulls dot={{ r: 4 }} activeDot={{ r: 6 }} />
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

        {/* 5. Emotion Distribution */}
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
              <Bar dataKey="interview_count" name={t('Interviews', 'Интервью')} fill="#8884d8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="reading_count" name={t('Reading Sessions', 'Чтений')} fill="#00d2ff" radius={[4, 4, 0, 0]} />
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
