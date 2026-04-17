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
                gap: "16px",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              }}
            >
              {history.mbi_results.map((rec) => (
                <div
                  key={rec.id}
                  className="upload-card"
                  style={{ padding: "20px" }}
                >
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#888",
                      marginBottom: "8px",
                    }}
                  >
                    {new Date(rec.created_at).toLocaleString()}
                  </p>
                  <h3 style={{ color: "white", marginBottom: "8px" }}>
                    Total Score: {calculateMBITotal(rec.answers)}
                  </h3>
                  <p style={{ fontSize: "14px", color: "#ccc" }}>
                    Gender: {rec.gender}
                  </p>
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
