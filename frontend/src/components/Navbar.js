import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <span className="brand-icon">🔥</span>
          <span className="brand-text">Burnout Predictor</span>
        </div>

        {isAuthenticated && (
          <div className="navbar-links">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-link-icon">📊</span>
              <span>Dashboard</span>
            </NavLink>
            <NavLink
              to="/speech"
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-link-icon">🎙️</span>
              <span>Speech Analysis</span>
            </NavLink>
            <NavLink
              to="/mbi"
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-link-icon">📋</span>
              <span>MBI Questionnaire</span>
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-link-icon">🕘</span>
              <span>History</span>
            </NavLink>
          </div>
        )}

        <div className="navbar-user">
          {isAuthenticated ? (
            <>
              <NavLink to="/profile" className="user-badge-link">
                <span className="user-badge">{user?.username}</span>
              </NavLink>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <NavLink to="/auth" className="nav-link">
              Login
            </NavLink>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
