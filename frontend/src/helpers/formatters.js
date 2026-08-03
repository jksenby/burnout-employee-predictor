export const formatFloat = (v) => (v != null ? Number(v).toFixed(4) : "—");
export const formatHz = (v) => (v != null ? `${Number(v).toFixed(1)} Hz` : "—");
export const formatDb = (v) => (v != null ? `${Number(v).toFixed(1)} dB` : "—");
export const formatRate = (v) =>
  v != null ? `${Number(v).toFixed(1)} /s` : "—";
export const formatPercent = (v) =>
  v != null ? `${(Number(v) * 100).toFixed(1)}%` : "—";
export const capitalize = (str) =>
  !str ? "—" : str.charAt(0).toUpperCase() + str.slice(1);

// Модель отдаёт "Medium Risk" (см. labels в model.py), а интерфейс везде ждал
// "Moderate Risk". Из-за расхождения счётчик умеренного риска в отчёте всегда
// показывал 0, а подписи падали в английский фолбэк вместо перевода.
const RISK_LABEL_ALIASES = { "Medium Risk": "Moderate Risk" };

export const normalizeRiskLabel = (label) =>
  label ? RISK_LABEL_ALIASES[label] || label : label;

// Отклонение от личной нормы: (-1, 1), положительное — хуже своей нормы.
// Это НЕ вероятность выгорания, поэтому и подписывается иначе, чем score.
export const formatDeviation = (v) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${(Number(v) * 100).toFixed(0)}`;

export const emotionIcon = (name) => {
  const icons = {
    angry: <i className="fa-solid fa-face-angry"></i>,
    happy: <i className="fa-solid fa-face-smile"></i>,
    sad: <i className="fa-solid fa-face-sad-tear"></i>,
    neutral: <i className="fa-solid fa-face-meh"></i>
  };
  return icons[name] || <i className="fa-solid fa-circle"></i>;
};

export const formatSentiment = (v) => {
  if (v == null) return "—";
  const n = Number(v);
  const label = n > 0.05 ? "Positive" : n < -0.05 ? "Negative" : "Neutral";
  return `${label} (${n.toFixed(2)})`;
};
