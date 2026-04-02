import React, { useState } from "react";
import AudioUpload from "../components/AudioUpload";
import AudioRecorder from "../components/AudioRecorder";
import LoadingIndicator from "../components/LoadingIndicator";
import ResultsPanel from "../components/ResultsPanel";
import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:8000/predict";

const SpeechAnalysisPage = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("upload");
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

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
        <h1>Speech Analysis</h1>
        <p className="subtitle">
          Multimodal speech analysis with late-fusion architecture
        </p>
        <div className="streams-badge">
          <span className="stream-chip hubert">HuBERT — Acoustics</span>
          <span className="stream-chip wavlm">WavLM — Prosody</span>
          <span className="stream-chip whisper">Whisper — Semantics</span>
        </div>
      </div>

      <div className="input-tabs">
        <button
          className={`input-tab ${activeTab === "upload" ? "active" : ""}`}
          onClick={() => handleTabChange("upload")}
        >
          Upload File
        </button>
        <button
          className={`input-tab ${activeTab === "record" ? "active" : ""}`}
          onClick={() => handleTabChange("record")}
        >
          Record Audio
        </button>
      </div>

      {activeTab === "upload" ? (
        <AudioUpload
          file={file}
          audioUrl={audioUrl}
          loading={loading}
          onFileSelect={handleFileSelect}
          onAnalyze={handleAnalyze}
        />
      ) : (
        <AudioRecorder
          file={file}
          audioUrl={audioUrl}
          loading={loading}
          onFileSelect={handleFileSelect}
          onAnalyze={handleAnalyze}
        />
      )}

      {loading && <LoadingIndicator />}

      <ResultsPanel data={data} />
    </>
  );
};

export default SpeechAnalysisPage;
