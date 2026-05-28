import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingIndicator from "../components/LoadingIndicator";

const DashboardPage = () => {
  const { t } = useTranslation();
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
        setError(t("dashboard.error_loading_schedule"));
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
    if (!dateStr) return t("dashboard.never");
    const date = new Date(dateStr);
    if(date.toString() === "Invalid Date") return t("dashboard.completed");
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const bothDue = schedule.mbi_due && schedule.speech_due;
  const allClear = !schedule.mbi_due && !schedule.speech_due;
  const isFirstMBI = schedule.mbi_count === 0 && schedule.today_task === 'mbi';
  const isFirstSpeech = schedule.mbi_count >= 1 && schedule.speech_count === 0 && schedule.today_task === 'speech';

  const mbiProgress = schedule.mbi_last_date
    ? Math.min(100, ((60 - schedule.mbi_days_remaining) / 60) * 100)
    : 0;
  const speechProgress = schedule.speech_last_date
    ? Math.min(100, ((7 - schedule.speech_days_remaining) / 7) * 100)
    : 0;

  return (
    <>
      <div className="page-header">
        <h1>{t("dashboard.title")}</h1>
        <p className="subtitle">
          {t("dashboard.welcome", { name: user?.username })}
        </p>
      </div>

      {/* ── Today's Task Hero ── */}
      <div className={`dash-hero ${allClear ? "clear" : schedule.today_task}`}>
        <div className="dash-hero-glow"></div>
        <div className="dash-hero-content">
          {allClear ? (
            <>
              <div className="dash-hero-icon">
                <i className="fa-solid fa-circle-check"></i>
              </div>
              <h2 className="dash-hero-title">{t("dashboard.all_caught_up")}</h2>
              <p className="dash-hero-desc">
                {t("dashboard.no_assessments")}
              </p>
            </>
          ) : (
            <>
              <p className="dash-hero-step-label">
                {(isFirstMBI || isFirstSpeech)
                  ? t("dashboard.onboarding_step", { step: isFirstMBI ? 1 : 2, total: 2 })
                  : t("dashboard.next_step")}
              </p>
              <div className="dash-hero-icon">
                {schedule.today_task === "mbi" ? (
                  <i className="fa-solid fa-clipboard-list"></i>
                ) : (
                  <i className="fa-solid fa-microphone"></i>
                )}
              </div>
              <h2 className="dash-hero-title">
                {schedule.today_task === "mbi"
                  ? t("dashboard.mbi_due")
                  : t("dashboard.speech_due")}
              </h2>
              {(isFirstMBI || isFirstSpeech) && (
                <p className="dash-hero-desc">
                  {isFirstMBI
                    ? t("dashboard.mbi_onboarding_desc")
                    : t("dashboard.speech_onboarding_desc")}
                </p>
              )}
              <div className="dash-hero-pills">
                <span className="dash-hero-pill">
                  <i className="fa-regular fa-clock"></i>
                  {schedule.today_task === "mbi"
                    ? t("dashboard.time_mbi")
                    : t("dashboard.time_speech")}
                </span>
                <span className="dash-hero-pill urgent">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  {t("dashboard.due_now")}
                </span>
              </div>
              {bothDue && (
                <div className="dash-hero-badge">
                  <span className="dash-badge-dot"></span>
                  {t("dashboard.priority_first")}
                </div>
              )}
              <button
                className="dash-hero-btn"
                onClick={() =>
                  navigate(schedule.today_task === "mbi" ? "/mbi" : "/speech")
                }
              >
                <span>
                  {schedule.today_task === "mbi"
                    ? t("dashboard.start_mbi")
                    : t("dashboard.start_speech")}
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
              {bothDue && (
                <p className="dash-hero-then">
                  <i className="fa-solid fa-arrow-right-long"></i>
                  {schedule.today_task === "mbi"
                    ? t("dashboard.then_speech")
                    : t("dashboard.then_mbi")}
                </p>
              )}
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
              <i className="fa-solid fa-clipboard-list"></i>
            </div>
            <div>
              <h3 className="dash-card-title">{t("dashboard.mbi_card_title")}</h3>
              <span className="dash-card-freq">{t("dashboard.mbi_card_freq")}</span>
            </div>
            {schedule.mbi_due && (
              <span className="dash-status-chip due">{t("dashboard.due_now")}</span>
            )}
            {!schedule.mbi_due && (
              <span className="dash-status-chip ok">{t("dashboard.on_track")}</span>
            )}
          </div>

          <div className="dash-card-body">
            <div className="dash-progress-row">
              <span className="dash-progress-label">{t("dashboard.cycle_progress")}</span>
              <span className="dash-progress-value">
                {schedule.mbi_due
                  ? t("dashboard.overdue")
                  : t("dashboard.days_left", { count: schedule.mbi_days_remaining })}
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
                <span className="dash-meta-label">{t("dashboard.last_completed")}</span>
                <span className="dash-meta-value">
                  {formatDate(schedule.mbi_last_date)}
                </span>
              </div>
              <div className="dash-meta-item">
                <span className="dash-meta-label">{t("dashboard.next_due")}</span>
                <span className="dash-meta-value">
                  {formatDate(schedule.mbi_next_date)}
                </span>
              </div>
            </div>
          </div>

          <button className="dash-card-action" onClick={() => navigate("/mbi")}>
            {schedule.mbi_due ? t("dashboard.take_assessment") : t("dashboard.view_mbi")}
          </button>
        </div>

        {/* Speech Card */}
        <div className={`dash-card ${schedule.speech_due ? "due" : ""}`}>
          <div className="dash-card-header">
            <div className="dash-card-icon-wrap speech">
              <i className="fa-solid fa-microphone"></i>
            </div>
            <div>
              <h3 className="dash-card-title">{t("dashboard.speech_card_title")}</h3>
              <span className="dash-card-freq">{t("dashboard.speech_card_freq")}</span>
            </div>
            {schedule.speech_due && (
              <span className="dash-status-chip due">{t("dashboard.due_now")}</span>
            )}
            {!schedule.speech_due && (
              <span className="dash-status-chip ok">{t("dashboard.on_track")}</span>
            )}
          </div>

          <div className="dash-card-body">
            <div className="dash-progress-row">
              <span className="dash-progress-label">{t("dashboard.cycle_progress")}</span>
              <span className="dash-progress-value">
                {schedule.speech_due
                  ? t("dashboard.overdue")
                  : t("dashboard.days_left", { count: schedule.speech_days_remaining })}
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
                <span className="dash-meta-label">{t("dashboard.last_completed")}</span>
                <span className="dash-meta-value">
                  {formatDate(schedule.speech_last_date)}
                </span>
              </div>
              <div className="dash-meta-item">
                <span className="dash-meta-label">{t("dashboard.next_due")}</span>
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
            {schedule.speech_due ? t("dashboard.start_analysis") : t("dashboard.view_speech")}
          </button>
        </div>
      </div>

      {/* ── Report Status Card ── */}
      <div className={`dash-report-card ${schedule.can_generate_report ? "ready" : "locked"}`}>
        <div className="dash-report-header">
          <div className="dash-report-icon">
            <i className={`fa-solid ${schedule.can_generate_report ? "fa-file-pdf" : "fa-lock"}`}></i>
          </div>
          <div className="dash-report-info">
            <h3 className="dash-report-title">{t("dashboard.report_status")}</h3>
            <p className="dash-report-desc">
              {schedule.can_generate_report 
                ? t("dashboard.report_desc_ready") 
                : t("dashboard.report_desc_locked")}
            </p>
          </div>
        </div>

        <div className="dash-report-progress">
          <div className="dash-report-stat">
            <span>{t("dashboard.mbi_progress", { count: schedule.mbi_count })}</span>
            <div className="dash-mini-progress">
              <div 
                className="dash-mini-fill mbi" 
                style={{ width: `${Math.min(100, (schedule.mbi_count / 2) * 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="dash-report-stat">
            <span>{t("dashboard.speech_progress", { count: schedule.speech_count })}</span>
            <div className="dash-mini-progress">
              <div 
                className="dash-mini-fill speech" 
                style={{ width: `${Math.min(100, (schedule.speech_count / 8) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <button 
          className="dash-report-btn" 
          disabled={!schedule.can_generate_report}
          onClick={async () => {
            if (schedule.can_generate_report) {
              try {
                const response = await fetch("http://localhost:8000/report/pdf", {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (!response.ok) throw new Error("Failed to generate report");
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `Burnout_Report_${user?.username}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.parentNode.removeChild(link);
              } catch (err) {
                console.error(err);
                alert("Failed to download report. Please try again later.");
              }
            }
          }}
        >
          <i className="fa-solid fa-download"></i>
          {t("dashboard.download_report_btn")}
        </button>
      </div>

      {/* ── Footnote ── */}
      <p className="dash-footnote">
        <i className="fa-solid fa-circle-info"></i>
        {t("dashboard.priority_note_short")}
      </p>
    </>
  );
};

export default DashboardPage;
