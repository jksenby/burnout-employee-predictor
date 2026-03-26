import React from "react";

const NavTabs = ({ view, setView }) => (
  <div className="nav-tabs">
    <button
      className={`nav-tab ${view === "audio" ? "active" : ""}`}
      onClick={() => setView("audio")}
    >
      Speech Analysis
    </button>
    <button
      className={`nav-tab ${view === "mbi" ? "active" : ""}`}
      onClick={() => setView("mbi")}
    >
      📋BI Questionnaire
    </button>
  </div>
);

export default NavTabs;
