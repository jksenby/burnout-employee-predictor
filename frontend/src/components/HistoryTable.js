import React from 'react';
import { emotionIcon } from '../helpers/formatters';

const HistoryTable = ({ data, onRowClick }) => {
  if (data.length === 0) {
    return <p style={{ color: "#888" }}>No speech analyses recorded yet.</p>;
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
            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600" }}>📅 Date & Time</th>
            <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600" }}>Risk Score</th>
            <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600" }}>Risk Level</th>
            <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600" }}>Confidence</th>
            <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600" }}>Emotion</th>
            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600" }}>Transcript</th>
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
                    {rec.label}
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
