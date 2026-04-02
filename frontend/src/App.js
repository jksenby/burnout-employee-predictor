import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import SpeechAnalysisPage from "./pages/SpeechAnalysisPage";
import MBIPage from "./pages/MBIPage";
import AuthPage from "./pages/AuthPage";
import HistoryPage from "./pages/HistoryPage";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/auth" replace />;
};

function AppRoutes() {
  return (
    <>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <SpeechAnalysisPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mbi"
            element={
              <ProtectedRoute>
                <MBIPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;