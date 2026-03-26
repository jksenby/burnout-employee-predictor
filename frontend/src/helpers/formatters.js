export const formatFloat = (v) => (v != null ? Number(v).toFixed(4) : "—");
export const formatHz = (v) => (v != null ? `${Number(v).toFixed(1)} Hz` : "—");
export const formatDb = (v) => (v != null ? `${Number(v).toFixed(1)} dB` : "—");
export const formatRate = (v) =>
  v != null ? `${Number(v).toFixed(1)} /s` : "—";
export const formatPercent = (v) =>
  v != null ? `${(Number(v) * 100).toFixed(1)}%` : "—";
export const capitalize = (str) =>
  !str ? "—" : str.charAt(0).toUpperCase() + str.slice(1);

export const emotionIcon = (name) => {
  const icons = { angry: "😠", happy: "😊", sad: "😢", neutral: "😐" };
  return icons[name] || "🔵";
};

export const formatSentiment = (v) => {
  if (v == null) return "—";
  const n = Number(v);
  const label = n > 0.05 ? "Positive" : n < -0.05 ? "Negative" : "Neutral";
  return `${label} (${n.toFixed(2)})`;
};
