import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

// Questions are now managed via i18next resources

const MBIQuestionnaire = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const MBI_QUESTIONS = t("mbi.questions", { returnObjects: true });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const formData = new FormData(e.target);
    const answers = {};
    for (let i = 0; i < MBI_QUESTIONS.length; i++) {
      const ans = formData.get(`q${i}`);
      if (!ans) {
        alert(t("mbi.please_answer", { num: i + 1 }));
        return;
      }
      answers[`q${i}`] = parseInt(ans, 10);
    }

    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/mbi/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ answers })
      });

      if (!response.ok) {
        throw new Error("Failed to submit questionnaire");
      }

      setSubmitted(true);
    } catch (err) {
        console.error(err);
        alert(err.message);
    } finally {
        setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="mbi-container" style={{ textAlign: "center", padding: "40px" }}>
        <h2>{t("mbi.thank_you")}</h2>
        <p style={{ color: "#aaa" }}>{t("mbi.success_msg")}</p>
        <button className="button" style={{ marginTop: '20px' }} onClick={() => setSubmitted(false)}>
          {t("mbi.take_again")}
        </button>
      </div>
    );
  }

  return (
  <div className="mbi-container">
    <div className="mbi-intro">
      <p>{t("mbi.intro")}</p>
      <p className="subtitle">{t("mbi.freq_subtitle")}</p>
    </div>

    <div className="mbi-scale-legend">
      <div><strong>0</strong><br/>{t("mbi.scale.never")}</div>
      <div><strong>1</strong><br/>{t("mbi.scale.few_times_year")}</div>
      <div><strong>2</strong><br/>{t("mbi.scale.once_month")}</div>
      <div><strong>3</strong><br/>{t("mbi.scale.few_times_month")}</div>
      <div><strong>4</strong><br/>{t("mbi.scale.once_week")}</div>
      <div><strong>5</strong><br/>{t("mbi.scale.few_times_week")}</div>
      <div><strong>6</strong><br/>{t("mbi.scale.every_day")}</div>
    </div>

    <form onSubmit={handleSubmit}>
      {MBI_QUESTIONS.map((q, idx) => (
        <div key={idx} className="mbi-question-item">
          <div className="mbi-question-text">{idx + 1}. {q}</div>
          <div className="mbi-options">
            {[0, 1, 2, 3, 4, 5, 6].map((val) => (
              <div key={val} className="mbi-option">
                <input type="radio" name={`q${idx}`} value={val} />
                <label>{val}</label>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button type="submit" className="button" style={{ marginTop: '20px' }} disabled={loading}>
        {loading ? t("mbi.submitting") : t("mbi.submit_btn")}
      </button>
    </form>
  </div>
)};

export default MBIQuestionnaire;
