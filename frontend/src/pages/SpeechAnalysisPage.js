import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import AudioUpload from "../components/AudioUpload";
import AudioRecorder from "../components/AudioRecorder";
import LoadingIndicator from "../components/LoadingIndicator";
import ResultsPanel from "../components/ResultsPanel";
import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:8000/predict";

const SpeechAnalysisPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("interview");
  const [uploadAnalysisType, setUploadAnalysisType] = useState("interview");
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [fatigueLevel, setFatigueLevel] = useState(5);
  const [stressEvents, setStressEvents] = useState(false);

  useEffect(() => {
    if (id) {
      const fetchHistorical = async () => {
        setLoading(true);
        setData(null);
        try {
          const res = await fetch(`http://localhost:8000/history/speech/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error("Failed to fetch past result");
          const result = await res.json();
          setData(result);
        } catch (err) {
          console.error(err);
          alert("Could not load past result.");
          navigate("/history");
        } finally {
          setLoading(false);
        }
      };
      fetchHistorical();
    } else if (!id && token) {
      const fetchQuestions = async () => {
        try {
          const res = await fetch(`http://localhost:8000/interview/questions`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const result = await res.json();
            setQuestions(result);
          }
        } catch (err) {
          console.error(err);
        }
      };
      fetchQuestions();
    }
  }, [id, token, navigate]);

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setAudioUrl(url);
    setData(null);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFile(null);
    setAudioUrl(null);
    setData(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    setData(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fatigue_level", fatigueLevel);
      formData.append("stress_events", stressEvents);
      formData.append("analysis_type", activeTab === "upload" ? uploadAnalysisType : activeTab);
      if (questions) {
        formData.append("week_number", questions.week_number);
      }

      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(API_URL, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Analysis failed");
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error:", error);
      alert(`Error analyzing audio: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>{t("speech_analysis.title")}</h1>
        <p className="subtitle">
          {t("speech_analysis.subtitle")}
        </p>
        <div className="streams-badge">
          <span className="stream-chip hubert">{t("speech_analysis.hubert")}</span>
          <span className="stream-chip wavlm">{t("speech_analysis.wavlm")}</span>
          <span className="stream-chip whisper">{t("speech_analysis.whisper")}</span>
        </div>
      </div>

      {id ? (
        <div style={{ marginBottom: "30px" }}>
          <button
            className="button"
            style={{ 
              backgroundColor: "transparent", 
              border: "1px solid #00d2ff",
              color: "#00d2ff",
              marginBottom: "20px"
            }}
            onClick={() => navigate("/history")}
          >
            ← {t("speech_analysis.back_to_history")}
          </button>
          <div className="card" style={{ padding: "10px", backgroundColor: "rgba(0, 210, 255, 0.05)", borderLeft: "4px solid #00d2ff" }}>
            <p style={{ margin: 0, color: "#ccc", fontSize: "14px" }}>
              <i className="fa-solid fa-clock-rotate-left"></i> {t("speech_analysis.viewing_history")} {data && new Date(data.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Mini-instructions */}
          <div style={{
            background: 'rgba(0, 210, 255, 0.05)',
            border: '1px solid rgba(0, 210, 255, 0.25)',
            borderRadius: '12px',
            padding: '20px 24px',
            marginBottom: '24px'
          }}>
            <p style={{ margin: '0 0 14px', fontWeight: 600, color: '#0077aa', fontSize: '14px', letterSpacing: '0.5px' }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: '8px' }}></i>
              {t("speech_analysis.instructions.title")}
            </p>
            <ol style={{ margin: 0, paddingLeft: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
              {t("speech_analysis.instructions.steps", { returnObjects: true }).map((step, i) => (
                <li key={i} style={{ color: '#1a1a1a', fontSize: '13px', lineHeight: '1.5' }}>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="input-tabs">
            <button
              className={`input-tab ${activeTab === "interview" ? "active" : ""}`}
              onClick={() => handleTabChange("interview")}
            >
              {t("speech_analysis.tabs.interview")}
            </button>
            <button
              className={`input-tab ${activeTab === "reading" ? "active" : ""}`}
              onClick={() => handleTabChange("reading")}
            >
              {t("speech_analysis.tabs.reading")}
            </button>
            <button
              className={`input-tab ${activeTab === "upload" ? "active" : ""}`}
              onClick={() => handleTabChange("upload")}
            >
              {t("speech_analysis.tabs.upload")}
            </button>
          </div>

          <div className="self-report-form" style={{ marginBottom: "20px", padding: "15px", backgroundColor: "rgba(0, 0, 0, 0.04)", borderRadius: "8px", border: "1px solid rgba(0, 0, 0, 0.12)" }}>
            <h3 style={{ marginBottom: "15px", fontSize: "16px", color: "#1a1a1a" }}><i className="fa-solid fa-clipboard-user"></i> {t("speech_analysis.self_report.title")}</h3>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", color: "#1a1a1a" }}>
                {t("speech_analysis.self_report.fatigue_label")} <span style={{ fontWeight: "bold", color: "#0077aa", fontSize: "18px", marginLeft: "10px" }}>{fatigueLevel}</span>
              </label>
              <input
                type="range"
                min="1" max="10"
                value={fatigueLevel}
                onChange={(e) => setFatigueLevel(e.target.value)}
                style={{ width: "100%", accentColor: "#0077aa" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#555", marginTop: "5px" }}>
                <span>{t("speech_analysis.self_report.full_energy")}</span>
                <span>{t("speech_analysis.self_report.exhausted")}</span>
              </div>
            </div>

            <div>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer", color: "#1a1a1a" }}>
                <input 
                  type="checkbox" 
                  checked={stressEvents} 
                  onChange={(e) => setStressEvents(e.target.checked)}
                  style={{ marginRight: "12px", width: "18px", height: "18px", accentColor: "#00d2ff" }}
                />
                {t("speech_analysis.self_report.stress_question")}
              </label>
            </div>
          </div>

          {activeTab === "upload" ? (
            <AudioUpload
              file={file}
              audioUrl={audioUrl}
              loading={loading}
              onFileSelect={handleFileSelect}
              onAnalyze={handleAnalyze}
              uploadAnalysisType={uploadAnalysisType}
              onUploadTypeChange={setUploadAnalysisType}
            />
          ) : (
            <AudioRecorder
              mode={activeTab}
              file={file}
              audioUrl={audioUrl}
              loading={loading}
              onFileSelect={handleFileSelect}
              onAnalyze={handleAnalyze}
              questions={questions}
            />
          )}
        </>
      )}

      {loading && !data && <LoadingIndicator />}

      <ResultsPanel data={data} />
    </>
  );
};

export default SpeechAnalysisPage;
