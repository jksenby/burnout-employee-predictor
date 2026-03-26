import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import Navbar from "./components/Navbar";
import SpeechAnalysisPage from "./pages/SpeechAnalysisPage";
import MBIPage from "./pages/MBIPage";

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<SpeechAnalysisPage />} />
          <Route path="/mbi" element={<MBIPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;