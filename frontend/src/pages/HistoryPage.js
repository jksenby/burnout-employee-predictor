import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingIndicator from "../components/LoadingIndicator";
import HistoryTable from "../components/HistoryTable";

const HistoryPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState({
    speech_analyses: [],
    mbi_results: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("http://localhost:8000/history", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch history");
        const data = await res.json();
        setHistory(data);
      } catch (err) {
        console.error(err);
        setError("Error loading history.");
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [token]);

  if (loading) return <LoadingIndicator />;

  if (error) {
    return (
      <div style={{ color: "#fc5c65", padding: "20px", textAlign: "center" }}>
        {error}
      </div>
    );
  }


  return (
    <>
      <div className="page-header">
        <h1>My History</h1>
        <p className="subtitle">
          Review your past speech analyses and questionnaire records
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "40px",
        }}
      >
        {/* Speech Records */}
        <section>
          <h2
            style={{
              marginBottom: "20px",
              borderBottom: "1px solid #333",
              paddingBottom: "10px",
            }}
          >
            <i className="fa-solid fa-microphone"></i> Speech Analyses
          </h2>
          <HistoryTable
            data={history.speech_analyses}
            onRowClick={(rec) => navigate(`/history/${rec.id}`)}
          />
        </section>

        {/* MBI Records */}
        <section>
          <h2
            style={{
              marginBottom: "20px",
              borderBottom: "1px solid #333",
              paddingBottom: "10px",
            }}
          >
            <i className="fa-solid fa-clipboard-list"></i> MBI Questionnaires
          </h2>
          {history.mbi_results.length === 0 ? (
            <p style={{ color: "#888" }}>
              No MBI questionnaires completed yet.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "24px",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              }}
            >
              {history.mbi_results.map((rec) => {
                const sbsiPercent = (rec.burnout_index * 100).toFixed(1);
                let riskLabel = "Low Risk";
                let riskColor = "var(--low-risk)";
                if (rec.burnout_index > 0.6) {
                  riskLabel = "High Risk";
                  riskColor = "var(--high-risk)";
                } else if (rec.burnout_index > 0.3) {
                  riskLabel = "Moderate Risk";
                  riskColor = "var(--medium-risk)";
                }

                return (
                  <div
                    key={rec.id}
                    className="upload-card"
                    style={{ 
                      padding: "24px", 
                      position: 'relative',
                      overflow: 'hidden',
                      borderTop: `4px solid ${riskColor}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                          {new Date(rec.created_at).toLocaleDateString()} at {new Date(rec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: riskColor, letterSpacing: '0.5px' }}>
                          {riskLabel}
                        </div>
                      </div>
                      <div className="stream-chip hubert" style={{ fontSize: '10px', padding: '4px 10px' }}>
                        {rec.gender}
                      </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>Burnout Index</span>
                        <span style={{ fontSize: '20px', fontWeight: '800', color: riskColor }}>{sbsiPercent}%</span>
                      </div>
                      <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${sbsiPercent}%`, background: riskColor, borderRadius: '4px' }}></div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>Exhaustion</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>{rec.emotional_exhaustion}</div>
                        <div style={{ fontSize: '9px', color: '#888' }}>max 54</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>Depersonal.</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>{rec.depersonalization}</div>
                        <div style={{ fontSize: '9px', color: '#888' }}>max 30</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>Reduction</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>{rec.reduction_of_achievements}</div>
                        <div style={{ fontSize: '9px', color: '#888' }}>max 48</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default HistoryPage;
