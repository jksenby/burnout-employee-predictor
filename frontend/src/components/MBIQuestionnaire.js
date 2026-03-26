import React from 'react';

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

const MBIQuestionnaire = () => (
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

    <form onSubmit={(e) => e.preventDefault()}>
      <div className="mbi-question-item">
        <div className="mbi-question-text">Your Gender</div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <label style={{ color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '14px' }}>
            <input type="radio" name="gender" value="male" style={{ marginRight: '8px', width: '16px', height: '16px', accentColor: '#7c5cfc' }} /> Male
          </label>
          <label style={{ color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '14px' }}>
            <input type="radio" name="gender" value="female" style={{ marginRight: '8px', width: '16px', height: '16px', accentColor: '#7c5cfc' }} /> Female
          </label>
        </div>
      </div>
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
      <button className="button" style={{ marginTop: '20px' }}>Submit Assessment</button>
    </form>
  </div>
);

export default MBIQuestionnaire;
