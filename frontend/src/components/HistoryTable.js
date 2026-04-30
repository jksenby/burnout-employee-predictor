import React from 'react';
import { useTranslation } from 'react-i18next';
import { emotionIcon } from '../helpers/formatters';

const HistoryTable = ({ data, onRowClick }) => {
  const { t } = useTranslation();
  if (data.length === 0) {
    return <p style={{ color: "#888" }}>{t("history_table.no_data")}</p>;
  }

  return (
    <div style={{ overflowX: "auto", marginBottom: "20px" }}>
      <table style={{
        width: "100%",
        borderCollapse: "collapse",
        backgroundColor: "#1c1c1c",
        color: "#fff",
        fontSize: "13px"
      }}>
        <thead>
          <tr style={{
            backgroundColor: "#2a2a2a",
            borderBottom: "2px solid #444",
            position: "sticky",
            top: 0
          }}>
            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600" }}>{t("history_table.date_time")}</th>
            <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600" }}>{t("history_table.week")}</th>
            <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600" }}>{t("history_table.fatigue_stress")}</th>
            <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600" }}>{t("history_table.risk_score")}</th>
            <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600" }}>{t("history_table.risk_level")}</th>
            <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600" }}>{t("history_table.confidence")}</th>
            <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600" }}>{t("history_table.emotion")}</th>
            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600" }}>{t("history_table.transcript")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((rec, index) => {
            const riskColor = rec.label.includes("High") 
              ? "#fc5c65" 
              : rec.label.includes("Medium") 
                ? "#ffa500" 
                : "#10b981";
            
            const scorePercent = (rec.score * 100).toFixed(1);
            const confidencePercent = (rec.confidence * 100).toFixed(1);
            
            return (
              <tr 
                key={rec.id}
                onClick={() => onRowClick(rec)}
                style={{
                  borderBottom: "1px solid #333",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  backgroundColor: index % 2 === 0 ? "#1c1c1c" : "#222"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#2a2a2a"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? "#1c1c1c" : "#222"}
              >
                <td style={{ padding: "12px 16px", fontSize: "12px", color: "#aaa" }}>
                  {new Date(rec.created_at).toLocaleString()}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center", color: "#00d2ff", fontWeight: "600" }}>
                  {rec.week_number ? `${t("history_table.week")} ${rec.week_number}` : '-'}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center", fontSize: "12px" }}>
                  {rec.fatigue_level ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span style={{ 
                        color: rec.fatigue_level > 7 ? '#fc5c65' : rec.fatigue_level > 4 ? '#ffa500' : '#10b981'
                      }}>
                        {t("history_table.fatigue")}: {rec.fatigue_level}/10
                      </span>
                      {rec.stress_events && (
                        <span style={{ fontSize: '10px', backgroundColor: 'rgba(252, 92, 101, 0.2)', color: '#fc5c65', padding: '2px 6px', borderRadius: '4px' }}>
                          {t("history_table.stressed")}
                        </span>
                      )}
                    </div>
                  ) : '-'}
                </td>
                <td style={{ 
                  padding: "12px 16px", 
                  textAlign: "center",
                  fontWeight: "600",
                  color: riskColor
                }}>
                  {scorePercent}%
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}>
                  <span style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: "4px",
                    backgroundColor: riskColor,
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: "600"
                  }}>
                    {rec.label === "Low Risk" ? t("history.low_risk") : 
                     rec.label === "Moderate Risk" ? t("history.moderate_risk") : 
                     rec.label === "High Risk" ? t("history.high_risk") : rec.label}
                  </span>
                </td>
                <td style={{ 
                  padding: "12px 16px", 
                  textAlign: "center",
                  color: "#aaa"
                }}>
                  {confidencePercent}%
                </td>
                <td style={{ 
                  padding: "12px 16px", 
                  textAlign: "center",
                  fontSize: "18px"
                }}>
                  {emotionIcon(rec.dominant_emotion || 'neutral')}
                </td>
                <td style={{ 
                  padding: "12px 16px",
                  maxWidth: "300px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: "#ccc",
                  fontSize: "12px"
                }}>
                  "{rec.transcript}"
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
