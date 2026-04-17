import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

const AuthPage = () => {
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
  };

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
              ? "Welcome back — sign in to continue"
              : "Get started — create your account"}
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
            Sign In
          </button>
          <button
            className={`auth-toggle-btn ${!isLogin ? "active" : ""}`}
            onClick={() => {
              setIsLogin(false);
              setError("");
            }}
            type="button"
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-form-group">
            <label htmlFor="username">
              <i className="fa-solid fa-user"></i>
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoComplete="username"
            />
          </div>

          {!isLogin && (
            <>
              <div className="auth-form-group">
                <label htmlFor="email">
                  <i className="fa-solid fa-envelope"></i>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="auth-form-group">
                <label htmlFor="gender">
                  <i className="fa-solid fa-venus-mars"></i>
                  Gender
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className="auth-select"
                >
                  <option value="" disabled>Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="auth-form-group">
                <label htmlFor="phone">
                  <i className="fa-solid fa-phone"></i>
                  Phone Number
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
                  Age
                </label>
                <select
                  id="age"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                  className="auth-select"
                >
                  <option value="" disabled>Select age</option>
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
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <div className="auth-error">
              <i className="fa-solid fa-circle-exclamation"></i>
              {error}
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? (
              <span className="auth-submit-loading">
                <span className="auth-spinner"></span>
                Please wait...
              </span>
            ) : isLogin ? (
              <>
                Sign In
                <i className="fa-solid fa-arrow-right"></i>
              </>
            ) : (
              <>
                Create Account
                <i className="fa-solid fa-user-plus"></i>
              </>
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <p className="auth-footer">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button className="auth-link" onClick={toggleMode} type="button">
            {isLogin ? "Create one" : "Sign in instead"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
