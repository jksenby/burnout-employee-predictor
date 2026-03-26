import React from "react";

const Header = ({ view }) => (
  <div className="app-header">
    <h1>Employee Burnout Predictor</h1>

    {view === "audio" ? (
      <>
        <p className="subtitle">
          Multimodal speech analysis with late-fusion architecture
        </p>
        <div className="streams-badge">
          <span className="stream-chip hubert">HuBERT — Acoustics</span>
          <span className="stream-chip wavlm">WavLM — Prosody</span>
          <span className="stream-chip whisper">Whisper — Semantics</span>
        </div>
      </>
    ) : (
      <p className="subtitle">
        Maslach Burnout Inventory (MBI) — Self-Assessment
      </p>
    )}
  </div>
);

export default Header;
