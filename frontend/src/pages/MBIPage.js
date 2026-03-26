import React from "react";
import MBIQuestionnaire from "../components/MBIQuestionnaire";

const MBIPage = () => (
  <>
    <div className="page-header">
      <h1>MBI Questionnaire</h1>
      <p className="subtitle">
        Maslach Burnout Inventory (MBI) — Self-Assessment
      </p>
    </div>

    <MBIQuestionnaire />
  </>
);

export default MBIPage;
