import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { normalizeRiskLabel } from '../helpers/formatters';
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

// Ползунок самооценки усталости в SpeechAnalysisPage.js задан как min=1 max=10.
// Отчёт раньше трактовал его как шкалу 1–5: писал «4.0 из 5» и на значении 4
// выдавал «это высокий показатель», то есть 4 из 10 — низкую усталость —
// описывал как высокую. Пороги ниже согласованы с раскраской в HistoryTable.
const FATIGUE_SCALE_MAX = 10;
const FATIGUE_HIGH = 7;
const FATIGUE_MODERATE = 5;

const plural = (n, one, few, many) => {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
};

const pluralSessions = (n) => plural(n, 'сессию', 'сессии', 'сессий');
const pluralWeeks = (n) => plural(n, 'неделя', 'недели', 'недель');

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
  // This page is authored with inline (English, Russian) string pairs rather
  // than i18next resource keys. i18next's t() would treat the 2nd arg as a
  // defaultValue and, since these keys don't exist, always return Russian —
  // so we use a small language-aware picker instead. (No Kazakh strings exist
  // on this page yet; kk falls back to English.)
  // useCallback обязателен: без него t пересоздаётся на каждом рендере, а он
  // входит в зависимости useMemo ниже — те пересчитывались бы всегда заново.
  const { i18n } = useTranslation();
  const t = useCallback(
    (en, ru) => (i18n.language && i18n.language.startsWith('ru') ? ru : en),
    [i18n.language]
  );
  const { token } = useAuth();
  const [reportData, setReportData] = useState([]);
  const [historyData, setHistoryData] = useState(null);
  const [trends, setTrends] = useState({});
  const [baselineInfo, setBaselineInfo] = useState({});
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
          interview_deviation: item.interview_deviation != null ? parseFloat(item.interview_deviation.toFixed(3)) : null,
          reading_deviation: item.reading_deviation != null ? parseFloat(item.reading_deviation.toFixed(3)) : null,
          absolutist_index: item.absolutist_index !== null ? parseFloat(item.absolutist_index.toFixed(3)) : null,
          negative_word_ratio: item.negative_word_ratio !== null ? parseFloat(item.negative_word_ratio.toFixed(3)) : null,
          sentiment_polarity: item.sentiment_polarity !== null ? parseFloat(item.sentiment_polarity.toFixed(3)) : null,
          speech_count: item.speech_count,
          interview_count: item.interview_count ?? 0,
          reading_count: item.reading_count ?? 0,
          mbi_count: item.mbi_count,
        }));

        setReportData(formattedData);
        setTrends(reportJson.trends || {});
        setBaselineInfo(reportJson.baseline || {});
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
    const interviews = speeches.filter(s => s.analysis_type === 'interview');
    const readings = speeches.filter(s => s.analysis_type === 'reading');

    const avgScore = (arr) => arr.length > 0
      ? arr.reduce((s, a) => s + a.score, 0) / arr.length
      : null;

    return {
      totalSpeech: speeches.length,
      totalInterview: interviews.length,
      totalReading: readings.length,
      totalMbi: mbis.length,
      avgSpeech: avgScore(speeches),
      avgInterview: avgScore(interviews),
      avgReading: avgScore(readings),
      latestMbi: mbis.length > 0 ? mbis[0].burnout_index : null,
    };
  }, [historyData]);

  // Главный лонгитюдный сигнал — тренд отклонения от ЛИЧНОЙ нормы. Абсолютный
  // score для динамики не годится: он несопоставим между людьми, а его разброс
  // между записями определяется в основном условиями записи (микрофон, комната,
  // время суток), а не состоянием человека. Тренд считает бэкенд по МНК и не
  // отдаёт направление, пока точек меньше трёх.
  const primaryTrend = useMemo(() => {
    const candidates = [
      { key: 'interview_deviation', modality: 'интервью', trend: trends.interview_deviation },
      { key: 'reading_deviation', modality: 'чтению текста', trend: trends.reading_deviation },
    ].filter(c => c.trend && c.trend.direction !== 'insufficient');

    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => b.trend.n_points - a.trend.n_points)[0];
  }, [trends]);

  const verdictData = useMemo(() => {
    if (!historyData) return null;
    const speeches = historyData.speech_analyses || [];
    const mbis = historyData.mbi_results || [];

    // Разница «первая → последняя» считается ВНУТРИ одного режима: раньше в
    // одну пару попадали интервью и чтение, и разница могла целиком
    // объясняться тем, что записи сделаны в разных условиях.
    const interviews = speeches.filter(s => s.analysis_type === 'interview');
    const readings = speeches.filter(s => s.analysis_type === 'reading');
    const modality = interviews.length > 1 ? interviews : readings;
    const modalityLabel = modality === interviews ? 'интервью' : 'чтению текста';

    const newestSpeech = modality[0] || speeches[0] || null;
    const oldestSpeech = modality.length > 1 ? modality[modality.length - 1] : null;
    const speechDelta = oldestSpeech && newestSpeech
      ? newestSpeech.score - oldestSpeech.score : null;

    const newestMbi = mbis[0] || null;
    const oldestMbi = mbis.length > 1 ? mbis[mbis.length - 1] : null;
    const mbiDelta = oldestMbi && newestMbi
      ? newestMbi.burnout_index - oldestMbi.burnout_index : null;

    // Направления берём из трендов бэкенда (МНК, минимум 3 точки), а не из
    // порога 0.05 на разнице двух замеров — тот порог срабатывал на обычном
    // измерительном шуме.
    const scoreTrendKey = modality === interviews ? 'interview_score' : 'reading_score';
    const speechTrend = trends[scoreTrendKey]?.direction || 'insufficient';
    const mbiTrend = trends.mbi_score?.direction || 'insufficient';
    const deviationTrend = primaryTrend?.trend?.direction || 'insufficient';

    // Приоритет у отклонения от личной нормы: это единственный ряд, который
    // сопоставим во времени для одного человека.
    let overallTrend = deviationTrend;
    if (overallTrend === 'insufficient') {
      const fallbacks = [speechTrend, mbiTrend].filter(x => x !== 'insufficient');
      if (fallbacks.includes('worsening')) overallTrend = 'worsening';
      else if (fallbacks.includes('improving')) overallTrend = 'improving';
      else if (fallbacks.length > 0) overallTrend = 'stable';
    }

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

    // normalizeRiskLabel обязателен: модель отдаёт "Medium Risk", а ключ здесь
    // всегда был "Moderate Risk" — счётчик умеренного риска показывал 0.
    const riskCounts = { 'Low Risk': 0, 'Moderate Risk': 0, 'High Risk': 0 };
    speeches.forEach(s => {
      const risk = normalizeRiskLabel(s.label);
      if (risk) riskCounts[risk] = (riskCounts[risk] || 0) + 1;
    });

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

    const mbPct = mbiDelta !== null ? Math.abs(mbiDelta * 100).toFixed(1) : null;

    const modalityBaseline = baselineInfo[modality === interviews ? 'interview' : 'reading'];

    let narrative;
    if (overallTrend === 'insufficient') {
      // Раньше в этой ветке выводилось «показатели стабильны» — то есть
      // отсутствие данных выглядело как подтверждённая норма.
      const need = modalityBaseline?.sessions_until_ready || 0;
      narrative = 'Данных пока недостаточно, чтобы говорить о динамике: для оценки тренда нужно минимум три недели с записями'
        + (need > 0
          ? `, а личная норма голоса наберётся ещё через ${need} ${pluralSessions(need)}`
          : '')
        + '. Оценки ниже описывают только текущий снимок, а не изменение.';
    } else if (deviationTrend !== 'insufficient') {
      const slopePts = Math.abs(primaryTrend.trend.slope * 100).toFixed(1);
      const weeks = primaryTrend.trend.n_points;
      const source = `по ${primaryTrend.modality}, ${weeks} ${pluralWeeks(weeks)} с данными`;

      if (deviationTrend === 'worsening') {
        narrative = `За период наблюдения голос всё сильнее отходит от вашей собственной нормы: отклонение растёт в среднем на ${slopePts} пункта в неделю (${source}). Речь сравнивается с тем, как вы звучали в начале наблюдения, а не со «средним человеком».`;
      } else if (deviationTrend === 'improving') {
        narrative = `За период наблюдения речь возвращается к вашей собственной норме: отклонение снижается в среднем на ${slopePts} пункта в неделю (${source}).`;
      } else {
        narrative = `Речь держится в пределах вашей собственной нормы — устойчивого сдвига за период наблюдения нет (${source}).`;
      }

      if (mbiTrend === 'worsening') {
        narrative += ` Опросник MBI показывает то же направление: индекс вырос на ${mbPct} п.п.`;
      } else if (mbiTrend === 'improving') {
        narrative += ` Опросник MBI показывает улучшение: индекс снизился на ${mbPct} п.п.`;
      } else if (mbPct !== null) {
        narrative += ` Индекс MBI изменился на ${mbPct} п.п. между первым и последним тестом — двух точек мало для тренда, это просто разница двух замеров.`;
      }
    } else {
      // Личной нормы ещё нет, но по абсолютным оценкам тренд уже считается.
      // Формулировки здесь осторожнее: абсолютный score чувствителен к условиям
      // записи, поэтому он показывает направление, но не величину эффекта.
      const parts = [];
      if (speechTrend === 'worsening') parts.push(`акустическая оценка по ${modalityLabel} растёт`);
      else if (speechTrend === 'improving') parts.push(`акустическая оценка по ${modalityLabel} снижается`);
      if (mbiTrend === 'worsening') parts.push('индекс MBI растёт');
      else if (mbiTrend === 'improving') parts.push('индекс MBI снижается');

      narrative = parts.length > 0
        ? `За период наблюдения ${parts.join(', ')}. Личная норма голоса ещё не набрана, поэтому направление опирается на абсолютные оценки — они чувствительны к условиям записи, и величину изменения по ним оценивать нельзя.`
        : 'Устойчивого изменения за период наблюдения не видно.';

      if (overallTrend === 'worsening') {
        narrative += ' Стоит следить за динамикой.';
      }
    }

    if (avgSentiment !== null && avgSentiment < -0.3) {
      narrative += ` Тональность речи выражено негативная (${avgSentiment.toFixed(2)}), что может свидетельствовать о психологическом напряжении.`;
    }

    return {
      overallTrend, speechTrend, mbiTrend, deviationTrend,
      speechDelta, mbiDelta,
      modalityLabel, modalityBaseline,
      newestSpeech, oldestSpeech, newestMbi, oldestMbi,
      avgSentiment, avgAbsolutist, avgNegRatio,
      dominantEmotion, dominantEmotionLabel,
      riskCounts, narrative,
      avgFatigueLevel, stressEventsCount, avgStreamContributions,
    };
  }, [historyData, trends, primaryTrend, baselineInfo]);

  const currentStateText = useMemo(() => {
    if (!verdictData || !summaryStats) return null;
    const {
      newestSpeech, newestMbi, oldestSpeech, oldestMbi,
      speechDelta, mbiDelta, modalityBaseline, modalityLabel,
      avgSentiment, dominantEmotionLabel, avgFatigueLevel, stressEventsCount,
    } = verdictData;

    const sentences = [];

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

    // Отклонение от личной нормы описывается отдельно от абсолютной оценки:
    // это разные величины, и путать их нельзя — первая говорит «изменилось
    // относительно вас самих», вторая «похоже на профиль риска в модели».
    if (modalityBaseline?.status === 'active' && modalityBaseline.latest_deviation != null) {
      const dev = modalityBaseline.latest_deviation;
      const devPts = Math.abs(dev * 100).toFixed(0);
      if (dev > 0.2) {
        sentences.push(
          `Если сравнивать не с другими людьми, а с вашей же обычной манерой говорить, ` +
          `последняя запись отклоняется на ${devPts} пункта в сторону монотонности и ` +
          `утомления (по ${modalityLabel}, норма снята по ${modalityBaseline.sessions} записям).`
        );
      } else if (dev < -0.2) {
        sentences.push(
          `Относительно вашей собственной обычной манеры говорить последняя запись ` +
          `звучит живее на ${devPts} пункта (по ${modalityLabel}).`
        );
      } else {
        sentences.push(
          `Относительно вашей собственной нормы речь в последней записи не изменилась — ` +
          `отклонение ${devPts} пункта, это в пределах обычного разброса (по ${modalityLabel}).`
        );
      }
    } else if (modalityBaseline?.status === 'calibrating') {
      sentences.push(
        `Личная норма голоса ещё набирается: нужно ещё ` +
        `${modalityBaseline.sessions_until_ready} ${pluralSessions(modalityBaseline.sessions_until_ready)}, ` +
        `после этого система сможет сравнивать вас с вами, а не со средним профилем.`
      );
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

    if (avgFatigueLevel !== null) {
      const level = `${avgFatigueLevel.toFixed(1)} из ${FATIGUE_SCALE_MAX}`;
      if (avgFatigueLevel >= FATIGUE_HIGH) {
        sentences.push(
          `Средний уровень усталости по вашей самооценке — ${level}. ` +
          'Это высокий показатель: похоже, вы регулярно приходите на сессии уже довольно уставшим.'
        );
      } else if (avgFatigueLevel >= FATIGUE_MODERATE) {
        sentences.push(
          `Средний уровень усталости по вашей самооценке — ${level}. ` +
          'Умеренно высоко — стоит следить за режимом отдыха.'
        );
      } else {
        sentences.push(`Усталость по вашей самооценке в среднем невысокая (${level}).`);
      }
    }

    // stress_events — галочка «были стрессовые события», которую пользователь
    // ставит сам в форме загрузки. Раньше здесь было написано «система
    // зафиксировала стрессовые паттерны в речи»: самоотчёт выдавался за
    // результат анализа, хотя ничего в речи по этому поводу не измеряется.
    if (stressEventsCount > 0 && summaryStats.totalSpeech > 0) {
      const ratio = stressEventsCount / summaryStats.totalSpeech;
      if (ratio > 0.5) {
        sentences.push(
          `В ${stressEventsCount} из ${summaryStats.totalSpeech} сессий вы сами отметили, что были стрессовые события — ` +
          'это больше половины всех записей.'
        );
      } else {
        sentences.push(
          `В ${stressEventsCount} ${stressEventsCount === 1 ? 'сессии' : 'сессиях'} из ` +
          `${summaryStats.totalSpeech} вы отметили стрессовые события.`
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
      // Без нормализации "Medium Risk" не находил себя в RISK_COLORS и сектор
      // получал случайный цвет из общей палитры.
      const risk = normalizeRiskLabel(s.label);
      counts[risk] = (counts[risk] || 0) + 1;
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
        emotion: EMOTION_LABELS[emotion.toLowerCase()] || (emotion.charAt(0).toUpperCase() + emotion.slice(1)),
        avg: parseFloat((total / counts[emotion]).toFixed(3)),
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [historyData]);

  const mbiRadarData = useMemo(() => {
    if (!historyData?.mbi_results?.length) return [];
    const latest = historyData.mbi_results[0];
    return [
      // MBI uses a 0–4 answer scale, so subscale maxima are: EE 9×4=36,
      // DP 5×4=20, PA 8×4=32, Reduction (32−PA) 0..32.
      { subject: t('Emot. Exhaustion', 'Эм. истощение'), value: parseFloat(((latest.emotional_exhaustion / 36) * 100).toFixed(1)) },
      { subject: t('Depersonaliz.', 'Деперсонализ.'), value: parseFloat(((latest.depersonalization / 20) * 100).toFixed(1)) },
      { subject: t('Personal Accomp.', 'Личн. достижения'), value: parseFloat(((latest.personal_accomplishment / 32) * 100).toFixed(1)) },
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
    improving:    { icon: '↓', label: 'Улучшение',        color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
    worsening:    { icon: '↑', label: 'Ухудшение',        color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
    stable:       { icon: '→', label: 'Стабильно',        color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
    // Отдельное состояние: раньше нехватка данных сваливалась в «Стабильно»,
    // то есть отсутствие измерений выглядело как подтверждённая норма.
    insufficient: { icon: '?', label: 'Данных мало',      color: '#6b7280', bg: '#f9fafb', border: '#d1d5db' },
  };

  const overallTrend = verdictData?.overallTrend || 'insufficient';
  const ti = trendInfo[overallTrend] || trendInfo.insufficient;

  return (
    <div className="report-container">

      <div className="report-header">
        <div>
          <h1 className="report-title">{t('Burnout Assessment Report', 'Отчёт об оценке выгорания')}</h1>
          <p className="report-subtitle">{t('8-Week Progress Overview', 'Обзор динамики за 8 недель')} · {new Date().toLocaleDateString()}</p>
        </div>
        <button className="download-btn no-print" onClick={handleDownloadPdf}>
          ⬇ {t('Download PDF', 'Скачать PDF')}
        </button>
      </div>

      {crossValFailed && (
        <div className="cross-val-warning">
          <span className="warning-icon">⚠</span>
          <div>
            <strong>{t('Warning', 'Внимание')}:</strong> {crossValMessage}
          </div>
        </div>
      )}

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
              {/* Тренд по личной норме — единственный ряд, сопоставимый во
                  времени. Остальные плашки подписаны как разница двух замеров,
                  чтобы их не читали как измеренное изменение. */}
              {primaryTrend && (
                <span style={{
                  background: 'rgba(255,255,255,0.85)',
                  border: `1px solid ${trendInfo[verdictData.deviationTrend].border}`,
                  borderRadius: 20,
                  padding: '3px 12px',
                  fontSize: 13,
                  color: trendInfo[verdictData.deviationTrend].color,
                  fontWeight: 600,
                }}>
                  Личная норма: {primaryTrend.trend.slope > 0 ? '+' : ''}
                  {(primaryTrend.trend.slope * 100).toFixed(1)} п./нед
                </span>
              )}
              {verdictData.speechDelta !== null && (
                <span style={{
                  background: 'rgba(255,255,255,0.85)',
                  border: '1px solid #e5e7eb',
                  borderRadius: 20,
                  padding: '3px 12px',
                  fontSize: 13,
                  color: '#6b7280',
                }}>
                  Речь, 1-я → посл.: {verdictData.speechDelta > 0 ? '+' : ''}
                  {(verdictData.speechDelta * 100).toFixed(1)} п.п.
                </span>
              )}
              {verdictData.mbiDelta !== null && (
                <span style={{
                  background: 'rgba(255,255,255,0.85)',
                  border: '1px solid #e5e7eb',
                  borderRadius: 20,
                  padding: '3px 12px',
                  fontSize: 13,
                  color: '#6b7280',
                }}>
                  MBI, 1-й → посл.: {verdictData.mbiDelta > 0 ? '+' : ''}
                  {(verdictData.mbiDelta * 100).toFixed(1)} п.п.
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

      {[['interview', 'Интервью'], ['reading', 'Чтение текста']]
        .some(([key]) => baselineInfo[key] && baselineInfo[key].status !== 'no_data') && (
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
            Личная норма голоса
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
            Абсолютные акустические показатели сильнее зависят от пола, возраста и
            микрофона, чем от состояния, поэтому динамика считается относительно
            вашей собственной нормы, снятой в начале наблюдения. Режимы
            калибруются раздельно: в чтении текст задан заранее, и просодия там
            другая.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(265px, 1fr))', gap: 16 }}>
            {[['interview', 'Интервью', '#8884d8'], ['reading', 'Чтение текста', '#00d2ff']].map(([key, title, accent]) => {
              const b = baselineInfo[key];
              if (!b || b.status === 'no_data') return null;

              const devColor = (v) => v == null ? '#6b7280'
                : v > 0.2 ? '#dc2626' : v < -0.2 ? '#16a34a' : '#d97706';

              return (
                <MetricBlock key={key} title={`Личная норма · ${title}`} accent={accent}>
                  {/* 'unavailable' — сессий хватает, но калибровочные записи
                      вырожденные (см. MIN_BASELINE_FEATURES в analysis.py).
                      Отдельная ветка обязательна: без неё этот статус попадал в
                      ветку «Норма набрана» и рисовал отклонение «+0» из null. */}
                  {b.status === 'unavailable' ? (
                    <>
                      <MetricRow label="Состояние" value="Норму снять не удалось" color="#dc2626" />
                      <MetricRow label="Записей снято" value={b.sessions} />
                      <MetricRow
                        label="Причина"
                        value="мало пригодных признаков"
                        note="в калибровочных записях не удалось надёжно измерить просодию; новые сессии сами по себе это не исправят"
                        color="#6b7280"
                      />
                      {b.legacy_sessions > 0 && (
                        <MetricRow
                          label="Не вошло в норму"
                          value={`${b.legacy_sessions} ${pluralSessions(b.legacy_sessions)}`}
                          note="прежний способ расчёта признаков"
                          color="#6b7280"
                        />
                      )}
                    </>
                  ) : b.status === 'calibrating' ? (
                    <>
                      <MetricRow label="Состояние" value="Калибровка" color="#6b7280" />
                      <MetricRow label="Записей снято" value={b.sessions} />
                      <MetricRow
                        label="Осталось до оценки"
                        value={`${b.sessions_until_ready} ${pluralSessions(b.sessions_until_ready)}`}
                        color="#d97706"
                      />
                      {b.legacy_sessions > 0 && (
                        <MetricRow
                          label="Не вошло в норму"
                          value={`${b.legacy_sessions} ${pluralSessions(b.legacy_sessions)}`}
                          note="прежний способ расчёта признаков"
                          color="#6b7280"
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <MetricRow label="Состояние" value="Норма набрана" color="#16a34a" />
                      <MetricRow label="Записей с оценкой" value={`${b.active_sessions} из ${b.sessions}`} />
                      <Divider />
                      <MetricRow
                        label="Последнее отклонение"
                        value={`${b.latest_deviation > 0 ? '+' : ''}${(b.latest_deviation * 100).toFixed(0)}`}
                        note={b.latest_deviation > 0.2 ? 'хуже нормы' : b.latest_deviation < -0.2 ? 'лучше нормы' : 'в норме'}
                        color={devColor(b.latest_deviation)}
                      />
                      <MetricRow
                        label="Среднее за период"
                        value={`${b.mean_deviation > 0 ? '+' : ''}${(b.mean_deviation * 100).toFixed(0)}`}
                        color={devColor(b.mean_deviation)}
                      />
                      {b.warning_sessions > 0 && (
                        <MetricRow
                          label="Записей с маркером"
                          value={`${b.warning_sessions} из ${b.active_sessions}`}
                          note="монотонность + дрожание"
                          color="#dc2626"
                        />
                      )}
                    </>
                  )}
                </MetricBlock>
              );
            })}
          </div>
        </div>
      )}

      {verdictData && summaryStats && (
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>
            Ключевые показатели
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(265px, 1fr))', gap: 16 }}>

            {historyData.speech_analyses?.length > 0 && (
              <MetricBlock title="Речевой анализ" accent="#8884d8">
                <MetricRow label="Всего сессий" value={summaryStats.totalSpeech} />
                {/* Средние по режимам раздельно: интервью и чтение снимаются в
                    разных условиях, общее среднее смешивало два измерения. */}
                {summaryStats.avgInterview !== null && (
                  <MetricRow
                    label="Средний риск · интервью"
                    value={`${(summaryStats.avgInterview * 100).toFixed(1)}%`}
                    color={getRiskColor(summaryStats.avgInterview)}
                    note={`${summaryStats.totalInterview} сес.`}
                  />
                )}
                {summaryStats.avgReading !== null && (
                  <MetricRow
                    label="Средний риск · чтение"
                    value={`${(summaryStats.avgReading * 100).toFixed(1)}%`}
                    color={getRiskColor(summaryStats.avgReading)}
                    note={`${summaryStats.totalReading} сес.`}
                  />
                )}
                {verdictData.oldestSpeech && verdictData.newestSpeech && (
                  <MetricRow
                    label={`1-я → посл. (${verdictData.modalityLabel})`}
                    value={`${(verdictData.oldestSpeech.score * 100).toFixed(1)}% → ${(verdictData.newestSpeech.score * 100).toFixed(1)}%`}
                    color={trendInfo[verdictData.speechTrend].color}
                  />
                )}
                {verdictData.avgFatigueLevel !== null && (
                  <MetricRow
                    label="Усталость (самооценка)"
                    value={verdictData.avgFatigueLevel.toFixed(1)}
                    // Знаменатель — максимум ШКАЛЫ, а не максимум наблюдённых
                    // значений: раньше здесь стоял Math.max по данным, и при
                    // ответах не выше 7 отчёт писал «3.5 из 7».
                    note={`из ${FATIGUE_SCALE_MAX}`}
                    color={verdictData.avgFatigueLevel >= FATIGUE_HIGH ? '#dc2626'
                      : verdictData.avgFatigueLevel >= FATIGUE_MODERATE ? '#d97706' : '#16a34a'}
                  />
                )}
                {verdictData.stressEventsCount > 0 && (
                  <MetricRow
                    label="Стрессовые события"
                    value={`${verdictData.stressEventsCount} из ${summaryStats.totalSpeech}`}
                    note="по самоотчёту"
                    color={verdictData.stressEventsCount / summaryStats.totalSpeech > 0.5 ? '#dc2626' : '#d97706'}
                  />
                )}
                <Divider />
                <MetricRow label="Низкий риск" value={`${verdictData.riskCounts['Low Risk']} сес.`} color="#16a34a" />
                <MetricRow label="Умеренный риск" value={`${verdictData.riskCounts['Moderate Risk']} сес.`} color="#d97706" />
                <MetricRow label="Высокий риск" value={`${verdictData.riskCounts['High Risk']} сес.`} color="#dc2626" />
              </MetricBlock>
            )}

            {historyData.mbi_results?.length > 0 && (() => {
              const m = historyData.mbi_results[0];
              // Cutoffs for the 0–4 answer scale (standard MBI-HSS bands
              // scaled by 4/6): EE max 36, DP max 20, PA max 32.
              const eeColor = m.emotional_exhaustion >= 18 ? '#dc2626' : m.emotional_exhaustion >= 11 ? '#d97706' : '#16a34a';
              const dpColor = m.depersonalization >= 9 ? '#dc2626' : m.depersonalization >= 5 ? '#d97706' : '#16a34a';
              const paColor = m.personal_accomplishment < 21 ? '#dc2626' : m.personal_accomplishment < 26 ? '#d97706' : '#16a34a';
              const raColor = m.reduction_of_achievements > 11 ? '#dc2626' : m.reduction_of_achievements > 6 ? '#d97706' : '#16a34a';
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
                    value={`${m.emotional_exhaustion} / 36`}
                    note={`${((m.emotional_exhaustion / 36) * 100).toFixed(0)}%`}
                    color={eeColor}
                  />
                  <MetricRow
                    label="Деперсонализация"
                    value={`${m.depersonalization} / 20`}
                    note={`${((m.depersonalization / 20) * 100).toFixed(0)}%`}
                    color={dpColor}
                  />
                  <MetricRow
                    label="Личн. достижения"
                    value={`${m.personal_accomplishment} / 32`}
                    note={`${((m.personal_accomplishment / 32) * 100).toFixed(0)}%`}
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

      <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>
        Графики
      </h2>
      <div className="charts-grid">

        {reportData.some(d => d.interview_deviation != null || d.reading_deviation != null) && (
          <div className="chart-card chart-card--wide">
            <h2 className="chart-title">
              {t('Deviation From Personal Baseline', 'Отклонение от личной нормы по неделям')}
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={reportData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis
                  domain={[-1, 1]}
                  tickFormatter={v => (v * 100).toFixed(0)}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)} п.`} />
                <Legend />
                {/* Ноль — собственная норма человека, а не «здоровое» значение. */}
                <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 4" />
                <Line
                  type="monotone" dataKey="interview_deviation"
                  name={t('Interview', 'Интервью')}
                  stroke="#8884d8" strokeWidth={2} connectNulls dot={{ r: 4 }} activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone" dataKey="reading_deviation"
                  name={t('Reading', 'Чтение текста')}
                  stroke="#00d2ff" strokeWidth={2} strokeDasharray="5 3" connectNulls dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p style={{ margin: '8px 4px 0', fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
              0 — ваша обычная норма, выше нуля — речь отклоняется в сторону
              монотонности, тише и с большими паузами. Точки появляются только
              после калибровки, поэтому первые недели наблюдения пустые.
            </p>
          </div>
        )}

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

        <div className="chart-card chart-card--wide">
          <h2 className="chart-title">{t('Linguistic & Semantic Features', 'Лингвистические и семантические признаки')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={reportData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              {/* Left axis: sentiment polarity (range -1..1) */}
              <YAxis yAxisId="sentiment" domain={[-1, 1]} tick={{ fontSize: 12 }} />
              {/* Right axis: ratios (typically 0..0.1) — own scale so they aren't flattened against zero */}
              <YAxis yAxisId="ratio" orientation="right" domain={[0, 'auto']} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v, name) => name === t('Sentiment', 'Тональность') ? v : `${(v * 100).toFixed(1)}%`} />
              <Legend />
              <Line yAxisId="ratio" type="monotone" dataKey="absolutist_index" name={t('Absolutist Index', 'Индекс абсолютизма')} stroke="#ff7300" strokeWidth={2} connectNulls dot={{ r: 3 }} />
              <Line yAxisId="ratio" type="monotone" dataKey="negative_word_ratio" name={t('Neg. Word Ratio', 'Доля негативных слов')} stroke="#f44336" strokeWidth={2} connectNulls dot={{ r: 3 }} />
              <Line yAxisId="sentiment" type="monotone" dataKey="sentiment_polarity" name={t('Sentiment', 'Тональность')} stroke="#387908" strokeWidth={2} connectNulls dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

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

      <div className="report-footer">
        <p>{t('Generated by Burnout Predictor System', 'Сгенерировано системой Burnout Predictor')}</p>
        <p>{new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
};

export default ReportPage;
