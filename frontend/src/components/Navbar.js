import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <span className="brand-icon">
            <i className="fa-solid fa-fire-flame-curved"></i>
          </span>
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
              <span className="nav-link-icon">
                <i className="fa-solid fa-chart-simple"></i>
              </span>
              <span>{t("nav.dashboard")}</span>
            </NavLink>
            <NavLink
              to="/speech"
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-link-icon">
                <i className="fa-solid fa-microphone"></i>
              </span>
              <span>{t("nav.analysis")}</span>
            </NavLink>
            <NavLink
              to="/mbi"
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-link-icon">
                <i className="fa-solid fa-clipboard-list"></i>
              </span>
              <span>{t("nav.mbi")}</span>
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-link-icon">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </span>
              <span>{t("nav.history")}</span>
            </NavLink>
            <NavLink
              to="/report"
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-link-icon">
                <i className="fa-solid fa-file-pdf"></i>
              </span>
              <span>{t("nav.report", "Report")}</span>
            </NavLink>
          </div>
        )}

        <div className="navbar-user">
          <div className="lang-switcher">
            <button 
              className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
              onClick={() => changeLanguage('en')}
            >
              EN
            </button>
            <button 
              className={`lang-btn ${i18n.language === 'ru' ? 'active' : ''}`}
              onClick={() => changeLanguage('ru')}
            >
              RU
            </button>
            <button 
              className={`lang-btn ${i18n.language === 'kk' ? 'active' : ''}`}
              onClick={() => changeLanguage('kk')}
            >
              KZ
            </button>
          </div>
          {isAuthenticated ? (
            <>
              <NavLink to="/profile" className="user-badge-link">
                <span className="user-badge">{user?.username}</span>
              </NavLink>
              <button className="logout-btn" onClick={handleLogout}>
                {t("nav.logout")}
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
