import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

const AuthPage = () => {
  const { t } = useTranslation();
  const { isAuthenticated, login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [age, setAge] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, email, password, gender, phoneNumber, age);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setPrivacyAccepted(false);
  };

  const privacySections = ["s1", "s2", "s3", "s4", "s5", "s6"];

  return (
    <div className="auth-page">
      {/* Animated background orbs */}
      <div className="auth-bg-orbs">
        <div className="auth-orb auth-orb-1"></div>
        <div className="auth-orb auth-orb-2"></div>
        <div className="auth-orb auth-orb-3"></div>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Burnout Predictor</h1>
          <p className="auth-subtitle">
            {isLogin
              ? t("auth.welcome_login")
              : t("auth.welcome_register")}
          </p>
        </div>

        <div className="auth-toggle">
          <div
            className="auth-toggle-slider"
            style={{
              transform: isLogin ? "translateX(0)" : "translateX(100%)",
            }}
          ></div>
          <button
            className={`auth-toggle-btn ${isLogin ? "active" : ""}`}
            onClick={() => {
              setIsLogin(true);
              setError("");
            }}
            type="button"
          >
            {t("auth.signin_tab")}
          </button>
          <button
            className={`auth-toggle-btn ${!isLogin ? "active" : ""}`}
            onClick={() => {
              setIsLogin(false);
              setError("");
            }}
            type="button"
          >
            {t("auth.register_tab")}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-form-group">
            <label htmlFor="username">
              <i className="fa-solid fa-user"></i>
              {t("auth.username")}
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("auth.username_placeholder")}
              required
              autoComplete="username"
            />
          </div>

          {!isLogin && (
            <>
              <div className="auth-form-group">
                <label htmlFor="email">
                  <i className="fa-solid fa-envelope"></i>
                  {t("auth.email")}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.email_placeholder")}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="auth-form-group">
                <label htmlFor="gender">
                  <i className="fa-solid fa-venus-mars"></i>
                  {t("auth.gender")}
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className="auth-select"
                >
                  <option value="" disabled>{t("auth.select_gender")}</option>
                  <option value="Male">{t("auth.male")}</option>
                  <option value="Female">{t("auth.female")}</option>
                  <option value="Other">{t("auth.other")}</option>
                </select>
              </div>
              <div className="auth-form-group">
                <label htmlFor="phone">
                  <i className="fa-solid fa-phone"></i>
                  {t("auth.phone")}
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+7 (777) 777-77-77"
                  required
                />
              </div>
              <div className="auth-form-group">
                <label htmlFor="age">
                  <i className="fa-solid fa-calendar-day"></i>
                  {t("auth.age")}
                </label>
                <select
                  id="age"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                  className="auth-select"
                >
                  <option value="" disabled>{t("auth.select_age")}</option>
                  {[...Array(100).keys()].map(i => (
                    <option key={i+18} value={i+18}>{i+18}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="auth-form-group">
            <label htmlFor="password">
              <i className="fa-solid fa-lock"></i>
              {t("auth.password")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.password_placeholder")}
              required
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>

          {!isLogin && (
            <div className="auth-privacy-check">
              <input
                id="privacy"
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                required
              />
              <label htmlFor="privacy">
                {t("privacy.checkbox_prefix")}
                <button
                  type="button"
                  className="auth-privacy-link"
                  onClick={() => setShowPrivacyModal(true)}
                >
                  {t("privacy.link")}
                </button>
                {t("privacy.checkbox_suffix", "")}
              </label>
            </div>
          )}

          {error && (
            <div className="auth-error">
              <i className="fa-solid fa-circle-exclamation"></i>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={submitting || (!isLogin && !privacyAccepted)}
          >
            {submitting ? (
              <span className="auth-submit-loading">
                <span className="auth-spinner"></span>
                {t("auth.please_wait")}
              </span>
            ) : isLogin ? (
              <>
                {t("auth.signin_btn")}
                <i className="fa-solid fa-arrow-right"></i>
              </>
            ) : (
              <>
                {t("auth.register_btn")}
                <i className="fa-solid fa-user-plus"></i>
              </>
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>{t("auth.or")}</span>
        </div>

        <p className="auth-footer">
          {isLogin ? t("auth.no_account") : t("auth.have_account")}{" "}
          <button className="auth-link" onClick={toggleMode} type="button">
            {isLogin ? t("auth.create_one") : t("auth.signin_instead")}
          </button>
        </p>
      </div>

      {showPrivacyModal && (
        <div className="privacy-modal-overlay" onClick={() => setShowPrivacyModal(false)}>
          <div className="privacy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="privacy-modal-header">
              <h2>{t("privacy.modal_title")}</h2>
              <button
                className="privacy-modal-close"
                onClick={() => setShowPrivacyModal(false)}
                type="button"
                aria-label={t("privacy.close")}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p className="privacy-modal-date">{t("privacy.last_updated")}</p>
            <div className="privacy-modal-body">
              {privacySections.map((s) => (
                <div key={s} className="privacy-section">
                  <h3>{t(`privacy.${s}_title`)}</h3>
                  <p>{t(`privacy.${s}_body`)}</p>
                </div>
              ))}
            </div>
            <div className="privacy-modal-footer">
              <button
                className="privacy-btn-accept"
                type="button"
                onClick={() => {
                  setPrivacyAccepted(true);
                  setShowPrivacyModal(false);
                }}
              >
                {t("privacy.accept")}
              </button>
              <button
                className="privacy-btn-close"
                type="button"
                onClick={() => setShowPrivacyModal(false)}
              >
                {t("privacy.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthPage;
