import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingIndicator from "../components/LoadingIndicator";

const DashboardPage = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const res = await fetch("http://localhost:8000/schedule", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch schedule");
        const data = await res.json();
        setSchedule(data);
      } catch (err) {
        console.error(err);
        setError("Could not load your schedule.");
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [token]);

  if (loading) return <LoadingIndicator />;

  if (error) {
    return (
      <div style={{ color: "#fc5c65", padding: "20px", textAlign: "center" }}>
        {error}
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const bothDue = schedule.mbi_due && schedule.speech_due;
  const allClear = !schedule.mbi_due && !schedule.speech_due;

  const mbiProgress = schedule.mbi_last_date
    ? Math.min(100, ((30 - schedule.mbi_days_remaining) / 30) * 100)
    : 0;
  const speechProgress = schedule.speech_last_date
    ? Math.min(100, ((7 - schedule.speech_days_remaining) / 7) * 100)
    : 0;

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="subtitle">
          Welcome back, {user?.username}. Here's your assessment schedule.
        </p>
      </div>

      {/* ── Today's Task Hero ── */}
      <div className={`dash-hero ${allClear ? "clear" : schedule.today_task}`}>
        <div className="dash-hero-glow"></div>
        <div className="dash-hero-content">
          {allClear ? (
            <>
              <div className="dash-hero-icon">✅</div>
              <h2 className="dash-hero-title">You're All Caught Up!</h2>
              <p className="dash-hero-desc">
                No assessments are due right now. Keep up the great work!
              </p>
            </>
          ) : (
            <>
              <div className="dash-hero-icon">
                {schedule.today_task === "mbi" ? "📋" : "🎙️"}
              </div>
              <h2 className="dash-hero-title">
                {schedule.today_task === "mbi"
                  ? "MBI Questionnaire Due"
                  : "Speech Analysis Due"}
              </h2>
              <p className="dash-hero-desc">
                {schedule.today_task === "mbi"
                  ? "It's time for your monthly Maslach Burnout Inventory assessment."
                  : "It's time for your weekly speech analysis check-in."}
              </p>
              {bothDue && (
                <div className="dash-hero-badge">
                  <span className="dash-badge-dot"></span>
                  Both assessments are due
                </div>
              )}
              <button
                className="dash-hero-btn"
                onClick={() =>
                  navigate(schedule.today_task === "mbi" ? "/mbi" : "/speech")
                }
              >
                <span>
                  Start{" "}
                  {schedule.today_task === "mbi"
                    ? "MBI Assessment"
                    : "Speech Analysis"}
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Schedule Cards ── */}
      <div className="dash-cards">
        {/* MBI Card */}
        <div className={`dash-card ${schedule.mbi_due ? "due" : ""}`}>
          <div className="dash-card-header">
            <div className="dash-card-icon-wrap mbi">
              <span>📋</span>
            </div>
            <div>
              <h3 className="dash-card-title">MBI Questionnaire</h3>
              <span className="dash-card-freq">Monthly · 30 day cycle</span>
            </div>
            {schedule.mbi_due && (
              <span className="dash-status-chip due">Due Now</span>
            )}
            {!schedule.mbi_due && (
              <span className="dash-status-chip ok">On Track</span>
            )}
          </div>

          <div className="dash-card-body">
            <div className="dash-progress-row">
              <span className="dash-progress-label">Cycle progress</span>
              <span className="dash-progress-value">
                {schedule.mbi_due
                  ? "Overdue"
                  : `${schedule.mbi_days_remaining} days left`}
              </span>
            </div>
            <div className="dash-progress-bar">
              <div
                className={`dash-progress-fill ${schedule.mbi_due ? "overdue" : "mbi"}`}
                style={{ width: `${schedule.mbi_due ? 100 : mbiProgress}%` }}
              ></div>
            </div>

            <div className="dash-card-meta">
              <div className="dash-meta-item">
                <span className="dash-meta-label">Last completed</span>
                <span className="dash-meta-value">
                  {formatDate(schedule.mbi_last_date)}
                </span>
              </div>
              <div className="dash-meta-item">
                <span className="dash-meta-label">Next due</span>
                <span className="dash-meta-value">
                  {formatDate(schedule.mbi_next_date)}
                </span>
              </div>
            </div>
          </div>

          <button className="dash-card-action" onClick={() => navigate("/mbi")}>
            {schedule.mbi_due ? "Take Assessment" : "View MBI"}
          </button>
        </div>

        {/* Speech Card */}
        <div className={`dash-card ${schedule.speech_due ? "due" : ""}`}>
          <div className="dash-card-header">
            <div className="dash-card-icon-wrap speech">
              <span>🎙️</span>
            </div>
            <div>
              <h3 className="dash-card-title">Speech Analysis</h3>
              <span className="dash-card-freq">Weekly · 7 day cycle</span>
            </div>
            {schedule.speech_due && (
              <span className="dash-status-chip due">Due Now</span>
            )}
            {!schedule.speech_due && (
              <span className="dash-status-chip ok">On Track</span>
            )}
          </div>

          <div className="dash-card-body">
            <div className="dash-progress-row">
              <span className="dash-progress-label">Cycle progress</span>
              <span className="dash-progress-value">
                {schedule.speech_due
                  ? "Overdue"
                  : `${schedule.speech_days_remaining} days left`}
              </span>
            </div>
            <div className="dash-progress-bar">
              <div
                className={`dash-progress-fill ${schedule.speech_due ? "overdue" : "speech"}`}
                style={{
                  width: `${schedule.speech_due ? 100 : speechProgress}%`,
                }}
              ></div>
            </div>

            <div className="dash-card-meta">
              <div className="dash-meta-item">
                <span className="dash-meta-label">Last completed</span>
                <span className="dash-meta-value">
                  {formatDate(schedule.speech_last_date)}
                </span>
              </div>
              <div className="dash-meta-item">
                <span className="dash-meta-label">Next due</span>
                <span className="dash-meta-value">
                  {formatDate(schedule.speech_next_date)}
                </span>
              </div>
            </div>
          </div>

          <button
            className="dash-card-action"
            onClick={() => navigate("/speech")}
          >
            {schedule.speech_due ? "Start Analysis" : "View Speech"}
          </button>
        </div>
      </div>

      {/* ── Priority Note ── */}
      <div className="dash-priority-note">
        <div className="dash-priority-icon">💡</div>
        <div>
          <strong>Scheduling Priority</strong>
          <p>
            MBI questionnaire (monthly) takes priority over Speech Analysis
            (weekly). When both are due on the same day, complete the MBI first.
          </p>
        </div>
      </div>
    </>
  );
};

export default DashboardPage;
