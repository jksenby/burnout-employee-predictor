import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MBIQuestionnaire = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});

  const MBI_QUESTIONS = t("mbi.questions", { returnObjects: true });
  const scaleOptions = t("mbi.scale_options", { returnObjects: true });

  const handleAnswer = async (value) => {
    const newAnswers = { ...answers, [`q${currentIdx}`]: value };
    setAnswers(newAnswers);

    if (currentIdx < MBI_QUESTIONS.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setLoading(true);
      try {
        const response = await fetch("http://localhost:8000/mbi/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ answers: newAnswers })
        });
        if (!response.ok) throw new Error("Failed to submit questionnaire");
        setSubmitted(true);
      } catch (err) {
        console.error(err);
        alert(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setCurrentIdx(0);
    setAnswers({});
  };

  if (loading) {
    return (
      <div className="mbi-container mbi-mcq-container" style={{ textAlign: 'center', padding: '60px' }}>
        <p style={{ color: 'var(--text-muted)' }}>{t("mbi.submitting")}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mbi-container mbi-mcq-container" style={{ textAlign: "center", padding: "40px" }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
        <h2>{t("mbi.thank_you")}</h2>
        <p style={{ color: "#aaa", marginTop: '8px' }}>{t("mbi.success_msg")}</p>
        <button
          className="button"
          style={{ marginTop: '24px' }}
          onClick={() => navigate('/')}
        >
          {t("mbi.back_to_dashboard")}
        </button>
      </div>
    );
  }

  const progress = (currentIdx / MBI_QUESTIONS.length) * 100;

  return (
    <div className="mbi-container mbi-mcq-container">
      <div className="mbi-mcq-header">
        <span className="mbi-mcq-progress-text">
          {t("mbi.question_of", { current: currentIdx + 1, total: MBI_QUESTIONS.length })}
        </span>
        <div className="mbi-mcq-progress-bar">
          <div className="mbi-mcq-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mbi-mcq-question">
        <p className="mbi-mcq-question-text">{MBI_QUESTIONS[currentIdx]}</p>
      </div>

      <div className="mbi-mcq-options">
        {scaleOptions.map((label, i) => (
          <button
            key={i}
            className="mbi-mcq-btn"
            onClick={() => handleAnswer(i)}
          >
            <span className="mbi-mcq-btn-index">{i}</span>
            {label}
          </button>
        ))}
      </div>

      {currentIdx > 0 && (
        <button className="mbi-mcq-back-btn" onClick={() => setCurrentIdx(currentIdx - 1)}>
          ← {t("mbi.back")}
        </button>
      )}
    </div>
  );
};

export default MBIQuestionnaire;
