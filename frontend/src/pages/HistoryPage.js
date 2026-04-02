import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import LoadingIndicator from "../components/LoadingIndicator";
import ResultsPanel from "../components/ResultsPanel";

const HistoryPage = () => {
  const { token } = useAuth();
  const [history, setHistory] = useState({ speech_analyses: [], mbi_results: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeSpeechResult, setActiveSpeechResult] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("http://localhost:8000/history", {
          headers: {
            Authorization: `Bearer ${token}`
          }
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
    return <div style={{ color: "#fc5c65", padding: "20px", textAlign: "center" }}>{error}</div>;
  }

  // Calculate some aggregate value for MBI, e.g. sum of all answers.
  const calculateMBITotal = (answers) => {
    if (!answers) return 0;
    return Object.values(answers).reduce((acc, val) => acc + val, 0);
  };

  return (
    <>
      <div className="page-header">
        <h1>My History</h1>
        <p className="subtitle">
          Review your past speech analyses and questionnaire records
        </p>
      </div>

      {activeSpeechResult && (
        <div style={{ marginBottom: "40px" }}>
          <button 
            className="button" 
            style={{ marginBottom: "20px" }} 
            onClick={() => setActiveSpeechResult(null)}
          >
            ← Back to History
          </button>
          <h3>Displaying Past Result: {new Date(activeSpeechResult.created_at).toLocaleString()}</h3>
          <ResultsPanel data={activeSpeechResult} />
        </div>
      )}

      <div style={{ display: activeSpeechResult ? "none" : "flex", flexDirection: "column", gap: "40px" }}>
        {/* Speech Records */}
        <section>
          <h2 style={{ color: "#fff", marginBottom: "20px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>🎙️ Speech Analyses</h2>
          {history.speech_analyses.length === 0 ? (
            <p style={{ color: "#888" }}>No speech analyses recorded yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
              {history.speech_analyses.map((rec) => (
                <div 
                  key={rec.id} 
                  className="upload-card" 
                  style={{ cursor: "pointer", padding: "20px", transition: "all 0.2s" }}
                  onClick={() => setActiveSpeechResult(rec)}
                >
                  <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>
                    {new Date(rec.created_at).toLocaleString()}
                  </p>
                  <h3 style={{ color: "white", marginBottom: "8px" }}>Burnout Risk: {(rec.score * 100).toFixed(1)}%</h3>
                  <div className="streams-badge" style={{ marginBottom: "12px", justifyContent: "flex-start" }}>
                    <span className="stream-chip hubert">{rec.label}</span>
                  </div>
                  <p style={{ fontSize: "14px", color: "#ccc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    "{rec.transcript}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* MBI Records */}
        <section>
          <h2 style={{ color: "#fff", marginBottom: "20px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>📋 MBI Questionnaires</h2>
          {history.mbi_results.length === 0 ? (
            <p style={{ color: "#888" }}>No MBI questionnaires completed yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
              {history.mbi_results.map((rec) => (
                <div key={rec.id} className="upload-card" style={{ padding: "20px" }}>
                  <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>
                    {new Date(rec.created_at).toLocaleString()}
                  </p>
                  <h3 style={{ color: "white", marginBottom: "8px" }}>Total Score: {calculateMBITotal(rec.answers)}</h3>
                  <p style={{ fontSize: "14px", color: "#ccc" }}>Gender: {rec.gender}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default HistoryPage;
