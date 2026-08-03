import React from 'react';
import { useTranslation } from 'react-i18next';
import { emotionIcon, normalizeRiskLabel } from '../helpers/formatters';

const HistoryTable = ({ data, onRowClick, emptyKey = "history_table.no_data" }) => {
  const { t } = useTranslation();

  if (data.length === 0) {
    return <p className="history-empty">{t(emptyKey)}</p>;
  }

  return (
    <div className="history-table-wrap">
      <table className="history-table">
        <thead>
          <tr>
            <th>{t("history_table.date_time")}</th>
            <th className="center">{t("history_table.week")}</th>
            <th className="center">{t("history_table.fatigue_stress")}</th>
            <th className="center">{t("history_table.risk_score")}</th>
            <th className="center">{t("history_table.risk_level")}</th>
            <th className="center">{t("history_table.confidence")}</th>
            <th className="center">{t("history_table.emotion")}</th>
            <th>{t("history_table.transcript")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((rec) => {
            const isHigh = rec.label.includes("High");
            const isMed  = rec.label.includes("Medium");
            const riskHex = isHigh ? "#f87171" : isMed ? "#fbbf24" : "#4ade80";

            const scorePercent = (rec.score * 100).toFixed(1);
            const confidencePercent = (rec.confidence * 100).toFixed(1);

            const fatigueColor = rec.fatigue_level > 7 ? '#dc2626'
              : rec.fatigue_level > 4 ? '#d97706' : '#16a34a';

            return (
              <tr key={rec.id} onClick={() => onRowClick(rec)}>
                <td className="muted">{new Date(rec.created_at).toLocaleString()}</td>
                <td className="center">
                  <span className="ht-week">
                    {rec.week_number ? `${t("history_table.week")} ${rec.week_number}` : '—'}
                  </span>
                </td>
                <td className="center">
                  {rec.fatigue_level ? (
                    <div className="ht-fatigue">
                      <span style={{ color: fatigueColor, fontWeight: 600 }}>
                        {t("history_table.fatigue")}: {rec.fatigue_level}/10
                      </span>
                      {rec.stress_events && (
                        <span className="ht-stressed">{t("history_table.stressed")}</span>
                      )}
                    </div>
                  ) : '—'}
                </td>
                <td className="center ht-score" style={{ color: riskHex }}>
                  {scorePercent}%
                </td>
                <td className="center">
                  <span className="ht-risk-badge" style={{ background: riskHex }}>
                    {(() => {
                      const risk = normalizeRiskLabel(rec.label);
                      return risk === "Low Risk" ? t("history.low_risk")
                        : risk === "Moderate Risk" ? t("history.moderate_risk")
                        : risk === "High Risk" ? t("history.high_risk") : risk;
                    })()}
                  </span>
                </td>
                <td className="center muted">{confidencePercent}%</td>
                <td className="center ht-emotion">
                  {emotionIcon(rec.dominant_emotion || 'neutral')}
                </td>
                <td className="ht-transcript">
                  {rec.transcript != null
                    ? `"${rec.transcript}"`
                    : <span className="muted">{t("history_table.reading_no_transcript", "Чтение текста")}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryTable;
