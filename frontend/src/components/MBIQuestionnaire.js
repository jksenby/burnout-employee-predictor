import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const MBI_QUESTIONS = [
  "I feel emotionally drained from my work.",
  "I feel used up at the end of the workday.",
  "I feel fatigued when I get up in the morning and have to face another day on the job.",
  "I can easily understand how my recipients feel about things.",
  "I feel I treat some recipients as if they were impersonal objects.",
  "Working with people all day is really a strain for me.",
  "I deal very effectively with the problems of my recipients.",
  "I feel burned out from my work.",
  "I feel I'm positively influencing other people's lives through my work.",
  "I've become more callous toward people since I took this job.",
  "I worry that this job is hardening me emotionally.",
  "I feel very energetic.",
  "I feel frustrated by my job.",
  "I feel I'm working too hard on my job.",
  "I don't really care what happens to some recipients.",
  "Working with people directly puts too much stress on me.",
  "I can easily create a relaxed atmosphere with my recipients.",
  "I feel exhilarated after working closely with my recipients.",
  "I have accomplished many worthwhile things in this job.",
  "I feel like I'm at the end of my rope.",
  "In my work, I deal with emotional problems very calmly.",
  "I feel that recipients blame me for some of their problems."
];

const MBIQuestionnaire = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const formData = new FormData(e.target);
    const answers = {};
    for (let i = 0; i < MBI_QUESTIONS.length; i++) {
      const ans = formData.get(`q${i}`);
      if (!ans) {
        alert(`Please answer question ${i + 1}.`);
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
        <h2>Thank You!</h2>
        <p style={{ color: "#aaa" }}>Your MBI assessment has been successfully recorded.</p>
        <button className="button" style={{ marginTop: '20px' }} onClick={() => setSubmitted(false)}>
          Take another assessment
        </button>
      </div>
    );
  }

  return (
  <div className="mbi-container">
    <div className="mbi-intro">
      <p>Please read each statement carefully and decide if you ever feel this way about your job.</p>
      <p className="subtitle">Select the number that best describes how frequently you feel that way.</p>
    </div>

    <div className="mbi-scale-legend">
      <div><strong>0</strong><br/>Never</div>
      <div><strong>1</strong><br/>A few times a year</div>
      <div><strong>2</strong><br/>Once a month</div>
      <div><strong>3</strong><br/>A few times a month</div>
      <div><strong>4</strong><br/>Once a week</div>
      <div><strong>5</strong><br/>A few times a week</div>
      <div><strong>6</strong><br/>Every day</div>
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
        {loading ? "Submitting..." : "Submit Assessment"}
      </button>
    </form>
  </div>
)};

export default MBIQuestionnaire;
