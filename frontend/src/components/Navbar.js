import React from "react";
import { NavLink } from "react-router-dom";
import "./Navbar.css";

const Navbar = () => (
  <nav className="navbar">
    <div className="navbar-inner">
      <div className="navbar-brand">
        <span className="brand-icon">🔥</span>
        <span className="brand-text">Burnout Predictor</span>
      </div>
      <div className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          <span className="nav-link-icon">🎙️</span>
          <span>Speech Analysis</span>
        </NavLink>
        <NavLink to="/mbi" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          <span className="nav-link-icon">📋</span>
          <span>MBI Questionnaire</span>
        </NavLink>
      </div>
    </div>
  </nav>
);

export default Navbar;
