import React, { useState, useEffect, useRef } from 'react';

function StudentExam({ examId }) {
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0);

  // Exam States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [isAutoSubmit, setIsAutoSubmit] = useState(false);
  const [submitReason, setSubmitReason] = useState('');

  // Timer States
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const timerIntervalRef = useRef(null);

  // Anti-Cheat States
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarningOverlay, setShowWarningOverlay] = useState(false);
  const isProcessingViolationRef = useRef(false);

  const MAX_WARNINGS = 1; // 2nd violation auto-submits

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!examId) {
      setError('No exam ID specified');
      setLoading(false);
      return;
    }
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadExamData();
    }
    return () => {
      clearInterval(timerIntervalRef.current);
      disableAntiCheat();
    };
  }, [examId]);

  // Load questions and details
  const loadExamData = async () => {
    try {
      const res = await fetch(`/api/student/exams/${examId}/start`);
      const data = await res.json();
      if (data.success) {
        setExam(data.exam);
        setQuestions(data.questions);
        setTimeLeft(data.exam.duration_minutes * 60);
        
        // Start countdown and enable security
        startTimer(data.exam.duration_minutes * 60);
        enableAntiCheat();
        requestFullscreen();
      } else {
        setError(data.message || 'Cannot start exam');
      }
    } catch (err) {
      setError('Error loading exam. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Timer logic
  const startTimer = (initialTime) => {
    let time = initialTime;
    timerIntervalRef.current = setInterval(() => {
      time--;
      setTimeLeft(time);
      if (time <= 0) {
        clearInterval(timerIntervalRef.current);
        autoSubmitExam('Time is up!');
      }
    }, 1000);
  };

  const getTimerClass = () => {
    if (timeLeft <= 60) return 'danger';
    if (timeLeft <= 300) return 'warning';
    return '';
  };

  const formatTime = () => {
    const min = Math.floor(timeLeft / 60);
    const sec = timeLeft % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Anti-Cheat logic
  const enableAntiCheat = () => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', blockEvent);
    document.addEventListener('keydown', blockShortcuts);
    document.addEventListener('copy', blockEvent);
    document.addEventListener('cut', blockEvent);
    document.addEventListener('paste', blockEvent);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
  };

  const disableAntiCheat = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', handleBlur);
    document.removeEventListener('contextmenu', blockEvent);
    document.removeEventListener('keydown', blockShortcuts);
    document.removeEventListener('copy', blockEvent);
    document.removeEventListener('cut', blockEvent);
    document.removeEventListener('paste', blockEvent);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
  };

  const blockEvent = (e) => {
    e.preventDefault();
    return false;
  };

  const blockShortcuts = (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) {
      e.preventDefault();
      return false;
    }
    // Block F12, PrintScreen, Escape
    if ([123, 44, 27].includes(e.keyCode)) {
      e.preventDefault();
      return false;
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden && !examSubmitted) {
      isProcessingViolationRef.current = true;
      handleViolation();
      setTimeout(() => {
        isProcessingViolationRef.current = false;
      }, 1000);
    }
  };

  const handleBlur = () => {
    if (!examSubmitted && !isProcessingViolationRef.current) {
      handleViolation();
    }
  };

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement && !examSubmitted) {
      handleViolation();
    }
  };

  const handleViolation = () => {
    if (examSubmitted) return;
    setTabSwitchCount((prev) => {
      const nextCount = prev + 1;
      if (nextCount > MAX_WARNINGS) {
        // Run auto submit directly
        autoSubmitExam('Tab switch violation - exam auto-submitted');
      } else {
        setShowWarningOverlay(true);
      }
      return nextCount;
    });
  };

  const dismissWarning = () => {
    setShowWarningOverlay(false);
    requestFullscreen();
  };

  const requestFullscreen = () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.msRequestFullscreen) el.msRequestFullscreen();
    } catch (e) {}
  };

  const exitFullscreen = () => {
    try {
      if (document.exitFullscreen) document.exitFullscreen();
    } catch (e) {}
  };

  // Submit Logic
  const handleOptionSelect = (qId, option) => {
    setAnswers((prev) => ({ ...prev, [qId]: option }));
  };

  const handleTextChange = (qId, text) => {
    setAnswers((prev) => ({ ...prev, [qId]: text }));
  };

  const submitExamManual = async () => {
    const answeredCount = Object.keys(answers).length;
    const totalCount = questions.length;
    const unanswered = totalCount - answeredCount;

    let msg = 'Are you sure you want to submit the exam?';
    if (unanswered > 0) {
      msg += `\n\n⚠️ You have ${unanswered} unanswered question(s)!`;
    }

    if (!confirm(msg)) return;
    await doSubmit(false);
  };

  const autoSubmitExam = async (reason) => {
    setIsAutoSubmit(true);
    setSubmitReason(reason);
    await doSubmit(true, reason);
  };

  const doSubmit = async (isAuto, reason = '') => {
    setExamSubmitted(true);
    clearInterval(timerIntervalRef.current);
    disableAntiCheat();
    exitFullscreen();

    try {
      const res = await fetch(`/api/student/exams/${examId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answers,
          tab_switches: tabSwitchCount + (isAuto && reason.includes('Tab') ? 1 : 0),
          auto_submitted: isAuto
        })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || 'Error submitting exam');
        window.navigateTo('/student/dashboard');
      }
    } catch (err) {
      alert('Network error submitting exam. Please check connection.');
      window.navigateTo('/student/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Preparing exam screen...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <span style={{ fontSize: '3rem' }}>⚠️</span>
        <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>
        <button className="btn btn-secondary" onClick={() => window.navigateTo('/student/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (examSubmitted) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', padding: '2rem' }}>
        <div className="glass-card" style={{ maxWidth: '500px', width: '100%', textAlign: 'center', padding: '3rem', animation: 'scaleIn 0.5s ease-out' }}>
          {isAutoSubmit && (
            <div className="badge badge-danger" style={{ display: 'block', padding: '0.75rem', marginBottom: '1.5rem', textTransform: 'none', fontSize: '0.85rem' }}>
              ⚠️ {submitReason || 'Exam was auto-submitted due to a security violation.'}
            </div>
          )}
          <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>✅</span>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>Exam Submitted Successfully!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            Your responses have been securely encrypted and stored in our database. You can return to your student dashboard now.
          </p>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.navigateTo('/student/dashboard')}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQ];
  const optionLabels = ['A', 'B', 'C', 'D'];
  const optionKeys = ['option_a', 'option_b', 'option_c', 'option_d'];

  return (
    <div>
      {/* Top Header */}
      <div className="exam-topbar">
        <div className="exam-title-bar">{exam && exam.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div className="form-label" style={{ margin: 0, fontWeight: 700 }}>
            Question {currentQ + 1} of {questions.length}
          </div>
          <div className={`exam-timer ${getTimerClass()}`}>
            ⏱️ {formatTime()}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="container exam-main-container">
        {currentQuestion && (
          <div className="glass-card question-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div className="question-num">Question {currentQ + 1}</div>
              <span className="badge badge-warning">{currentQuestion.marks} Marks</span>
            </div>
            
            <div className="question-text">
              {currentQuestion.question_text}
            </div>

            {currentQuestion.question_type === 'PROGRAM' ? (
              <div>
                <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
                  Write your code response below:
                </label>
                <textarea
                  className="code-editor"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleTextChange(currentQuestion.id, e.target.value)}
                  placeholder="// Type your program code here..."
                />
              </div>
            ) : (
              <div className="options-grid">
                {optionLabels.map((lbl, idx) => {
                  const optionVal = currentQuestion[optionKeys[idx]];
                  if (!optionVal) return null;
                  const isSelected = answers[currentQuestion.id] === lbl;
                  return (
                    <button
                      key={lbl}
                      className={`option-button ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleOptionSelect(currentQuestion.id, lbl)}
                    >
                      <span className="option-letter">{lbl}</span>
                      <span>{optionVal}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Nav controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
              <button
                className="btn btn-secondary"
                disabled={currentQ === 0}
                onClick={() => setCurrentQ(currentQ - 1)}
              >
                ← Previous
              </button>
              
              <button className="btn btn-primary" onClick={submitExamManual}>
                📤 Submit Exam
              </button>

              <button
                className="btn btn-secondary"
                disabled={currentQ === questions.length - 1}
                onClick={() => setCurrentQ(currentQ + 1)}
              >
                Next →
              </button>
            </div>

            {/* Pagination Navigation Dots */}
            <div className="q-navigation-grid" style={{ marginTop: '2rem' }}>
              {questions.map((q, idx) => {
                let statusClass = '';
                if (idx === currentQ) statusClass = 'current';
                else if (answers[q.id]) statusClass = 'answered';
                
                return (
                  <button
                    key={q.id}
                    className={`q-nav-dot ${statusClass}`}
                    onClick={() => setCurrentQ(idx)}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* WARNING OVERLAY */}
      {showWarningOverlay && (
        <div className="warning-screen">
          <div className="warning-icon-large">⚠️</div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--danger)', marginBottom: '0.75rem' }}>
            TAB SWITCH VIOLATION DETECTED
          </h2>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Violation count: {tabSwitchCount} / {MAX_WARNINGS + 1}
          </p>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 2rem', lineHeight: '1.6' }}>
            Attention: You are not allowed to navigate away from the exam. Your activity is being monitored.
            <strong style={{ color: 'var(--danger)', display: 'block', marginTop: '0.5rem' }}>
              NEXT DETECTED TAB SWITCH WILL FORCE AUTO-SUBMISSION!
            </strong>
          </p>
          <button className="btn btn-danger" style={{ padding: '0.85rem 2rem' }} onClick={dismissWarning}>
            Return to Examination
          </button>
        </div>
      )}
    </div>
  );
}

export default StudentExam;
