import React, { useState, useEffect, useRef } from 'react';

function StudentExam({ examId }) {
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0);

  // Exam States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [isAutoSubmit, setIsAutoSubmit] = useState(false);
  const [submitReason, setSubmitReason] = useState('');
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [isPartialRetake, setIsPartialRetake] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Timer States
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const timerIntervalRef = useRef(null);

  // Anti-Cheat States
  const [tabSwitchCount, setTabSwitchCount] = useState(() => {
    try {
      // Extract exam ID from component state if available
      const pathParts = window.location.pathname.split('/');
      const id = examId || pathParts[pathParts.length - 1];
      const val = sessionStorage.getItem(`exam_${id}_warnings`);
      return val ? parseInt(val) : 0;
    } catch (e) {
      return 0;
    }
  });
  const [showWarningOverlay, setShowWarningOverlay] = useState(false);
  const [agreedToProctoring, setAgreedToProctoring] = useState({
    fullscreen: false,
    tabSwitch: false,
    noCheating: false
  });
  const isProcessingViolationRef = useRef(false);
  const isUnloadingRef = useRef(false);

  const MAX_WARNINGS = 3; // 4th violation auto-submits

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

  // Set up unload listener to ignore reload-induced blur/visibilitychange events
  useEffect(() => {
    const handleBeforeUnload = () => {
      isUnloadingRef.current = true;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Keep-alive: ping backend every 90s while exam is active to prevent Render cold starts + session loss
  useEffect(() => {
    if (!isStarted || examSubmitted) return;
    const pingInterval = setInterval(async () => {
      try {
        await fetch('/api/auth/check-session', { credentials: 'include' });
      } catch (e) {
        // Silently ignore ping failures
      }
    }, 90000); // every 90 seconds
    return () => clearInterval(pingInterval);
  }, [isStarted, examSubmitted]);

  // Auto-save answers + current question + isStarted status to localStorage
  useEffect(() => {
    if (isStarted && examId && !examSubmitted) {
      try {
        localStorage.setItem(`exam_${examId}_progress`, JSON.stringify({
          answers,
          currentQ,
          examId,
          isStarted: true
        }));
      } catch (e) {
        console.error('Error saving progress:', e);
      }
    }
  }, [answers, currentQ, isStarted, examId, examSubmitted]);

  // Persist warnings count to sessionStorage
  useEffect(() => {
    if (isStarted && examId) {
      try {
        sessionStorage.setItem(`exam_${examId}_warnings`, tabSwitchCount.toString());
      } catch (e) {
        console.error('Error saving warnings count:', e);
      }
    }
  }, [tabSwitchCount, isStarted, examId]);

  // Load questions and details
  const loadExamData = async () => {
    try {
      const res = await fetch(`/api/student/exams/${examId}/start`);
      const data = await res.json();
      if (data.success) {
        setExam(data.exam);
        setQuestions(data.questions);
        setTimeLeft(data.exam.duration_minutes * 60);
        setIsPartialRetake(!!data.partial_retake);
        
        // Restore saved progress (answers + question index)
        if (!data.partial_retake) {
          try {
            const progress = localStorage.getItem(`exam_${examId}_progress`);
            if (progress) {
              const parsed = JSON.parse(progress);
              if (parsed.answers) setAnswers(parsed.answers);
              // Check if resuming via URL param or saved state
              const urlParams = new URLSearchParams(window.location.search);
              const isResume = urlParams.get('resume') === '1' || parsed.isStarted;
              if (isResume && typeof parsed.currentQ === 'number' && parsed.currentQ > 0) {
                setCurrentQ(parsed.currentQ);
              }
            }
          } catch (e) {
            console.error('Error restoring progress:', e);
          }
        }
      } else {
        setError(data.message || 'Cannot start exam');
      }
    } catch (err) {
      setError('Error loading exam. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = (autoStart = false) => {
    requestFullscreen();
    startTimer(timeLeft);
    enableAntiCheat();
    setIsStarted(true);
  };

  // Auto-start if resuming from a previous session
  useEffect(() => {
    if (!loading && exam && !isStarted && !examSubmitted) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('resume') === '1') {
          // Auto-tick all consent checkboxes and start
          setAgreedToProctoring({ fullscreen: true, tabSwitch: true, noCheating: true });
          // Short delay to let state settle, then auto-start
          setTimeout(() => handleStartExam(true), 400);
        }
      } catch (e) {}
    }
  }, [loading, exam]);

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
    if (isUnloadingRef.current) return;
    if (document.hidden && !examSubmitted) {
      isProcessingViolationRef.current = true;
      handleViolation();
      setTimeout(() => {
        isProcessingViolationRef.current = false;
      }, 1000);
    }
  };

  const handleBlur = () => {
    if (isUnloadingRef.current) return;
    if (!examSubmitted && !isProcessingViolationRef.current) {
      handleViolation();
    }
  };

  const handleFullscreenChange = () => {
    if (isUnloadingRef.current) return;
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
    setIsSubmitting(true);
    clearInterval(timerIntervalRef.current);
    disableAntiCheat();
    exitFullscreen();

    const payload = {
      answers: answers,
      tab_switches: tabSwitchCount + (isAuto && reason.includes('Tab') ? 1 : 0),
      auto_submitted: isAuto
    };

    // Try up to 3 times with exponential backoff
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(`/api/student/exams/${examId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          setIsSubmitting(false);
          setEvaluationResult(data.evaluation);
          try {
            localStorage.removeItem(`exam_${examId}_progress`);
            sessionStorage.removeItem(`exam_${examId}_warnings`);
          } catch (e) {
            console.error('Error clearing storage progress:', e);
          }
          return; // Success — stop retrying
        } else {
          // Server returned a proper error (e.g., already submitted)
          if (res.status === 403 && data.message && data.message.includes('already submitted')) {
            // Treat as success — they already submitted, show the dashboard
            alert('Your exam has already been submitted.');
            window.navigateTo('/student/dashboard');
            return;
          }
          alert(data.message || 'Error submitting exam');
          return;
        }
      } catch (err) {
        console.error(`Submit attempt ${attempt} failed:`, err);
        if (attempt < maxRetries) {
          // Wait before retry: 2s, then 4s
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        } else {
          // All retries exhausted — show error but DO NOT navigate away
          setIsSubmitting(false);
          setExamSubmitted(false);
          alert(`Network error submitting exam (${maxRetries} attempts failed). Please check your connection. Your answers are saved — tap OK and try the Submit button again.`);
        }
      }
    }
  };


  if (loading || isSubmitting) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.18) 0%, #0a0a1a 60%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, gap: '2rem'
      }}>
        {/* Animated spinner ring */}
        <div style={{ position: 'relative', width: '96px', height: '96px' }}>
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            border: '4px solid rgba(99,102,241,0.15)',
            borderTopColor: '#6366f1',
            animation: 'spin 1s linear infinite'
          }} />
          <div style={{
            position: 'absolute', inset: '14px',
            borderRadius: '50%',
            border: '3px solid rgba(139,92,246,0.15)',
            borderTopColor: '#8b5cf6',
            animation: 'spin 1.4s linear infinite reverse'
          }} />
          <div style={{
            position: 'absolute', inset: '28px',
            borderRadius: '50%',
            border: '2px solid rgba(167,139,250,0.2)',
            borderTopColor: '#a78bfa',
            animation: 'spin 0.8s linear infinite'
          }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {isSubmitting ? 'Submitting Your Exam…' : 'Preparing exam screen...'}
          </div>
          {isSubmitting && (
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem', marginTop: '0.65rem', fontWeight: 500 }}>
              Please wait — do not close this tab or press Back.
            </div>
          )}
        </div>
        {isSubmitting && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#6366f1',
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                opacity: 0.6
              }} />
            ))}
          </div>
        )}
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse {
            0%, 100% { transform: scale(0.7); opacity: 0.4; }
            50% { transform: scale(1.2); opacity: 1; }
          }
        `}</style>
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

  if (!isStarted) {
    const isStartEnabled = agreedToProctoring.fullscreen && agreedToProctoring.tabSwitch && agreedToProctoring.noCheating;

    return (
      <div className="flex-center" style={{ minHeight: '100vh', padding: '2rem', background: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.05), transparent 40%)' }}>
        <div className="glass-card" style={{ maxWidth: '950px', width: '100%', padding: '2.5rem', border: '1px solid var(--border-glass)', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
            <span style={{ fontSize: '3rem' }}>🛡️</span>
            <div>
              <h1 className="text-gradient" style={{ fontSize: '2rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>ExamGuard Secure Portal</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.2rem 0 0' }}>Candidate Verification & Mandatory Proctoring Instructions</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '2.5rem', alignItems: 'start' }}>
            {/* Left Panel - Exam Details & Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Assessment Profile</span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: '0.25rem 0' }}>{exam && exam.title}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', margin: '0.5rem 0 0' }}>
                  {exam && exam.description || 'No guidelines description provided. Please satisfy all proctoring criteria before entering.'}
                </p>
              </div>

              {isPartialRetake && (
                <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>📝</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.9rem' }}>New Questions Added — Partial Retake</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem', lineHeight: '1.5' }}>
                      You have already submitted this exam. <strong style={{ color: '#fff' }}>Only the {questions.length} newly added question{questions.length > 1 ? 's' : ''}</strong> will be shown. Your previous answers and score are preserved and will be updated once you submit.
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>⏱️ Timer Duration</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>{exam && exam.duration_minutes} Minutes</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>❓ Questions Count</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>{questions.length} Items</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Declaration of Consent</span>
                
                <label style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  <input 
                    type="checkbox" 
                    style={{ marginTop: '0.2rem', width: '17px', height: '17px', cursor: 'pointer' }}
                    checked={agreedToProctoring.fullscreen}
                    onChange={(e) => setAgreedToProctoring(prev => ({ ...prev, fullscreen: e.target.checked }))}
                  />
                  <span>I agree to enter <strong>Fullscreen Mode</strong> and will not try to exit fullscreen until my exam is fully submitted.</span>
                </label>

                <label style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  <input 
                    type="checkbox" 
                    style={{ marginTop: '0.2rem', width: '17px', height: '17px', cursor: 'pointer' }}
                    checked={agreedToProctoring.tabSwitch}
                    onChange={(e) => setAgreedToProctoring(prev => ({ ...prev, tabSwitch: e.target.checked }))}
                  />
                  <span>I understand that switching tabs is strictly forbidden and I have a <strong>maximum of 3 warnings</strong>. A 4th switch will auto-submit my exam.</span>
                </label>

                <label style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  <input 
                    type="checkbox" 
                    style={{ marginTop: '0.2rem', width: '17px', height: '17px', cursor: 'pointer' }}
                    checked={agreedToProctoring.noCheating}
                    onChange={(e) => setAgreedToProctoring(prev => ({ ...prev, noCheating: e.target.checked }))}
                  />
                  <span>I acknowledge that right-click, copy-paste, and developer shortcuts (F12, print screen) are disabled.</span>
                </label>
              </div>
            </div>

            {/* Right Panel - Compliance Warning Details */}
            <div style={{ background: 'rgba(255, 82, 82, 0.03)', border: '1px solid rgba(255, 82, 82, 0.15)', borderRadius: '16px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--danger)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🚨</span> CRITICAL SECURITY PROTOCOLS
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.2rem', color: 'var(--danger)' }}>🚫</span>
                  <div>
                    <strong style={{ color: '#fff' }}>Tab & Window Switches:</strong>
                    <br />
                    Navigating to other apps, opening chat platforms, opening search engines, or switching tabs is fully tracked. You are only allowed 3 warning prompts. The 4th instance triggers an auto-submit.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.2rem', color: 'var(--danger)' }}>🖥️</span>
                  <div>
                    <strong style={{ color: '#fff' }}>Fullscreen Mandate:</strong>
                    <br />
                    The assessment must be taken in fullscreen. Do not press Escape or click away. Leaving fullscreen is treated as a security violation.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.2rem', color: 'var(--danger)' }}>⌨️</span>
                  <div>
                    <strong style={{ color: '#fff' }}>Keyboard & Mouse Actions:</strong>
                    <br />
                    All keys like Control, Alt, Command, F12, and print screens are blocked. Right-clicking or copy-pasting is restricted.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.2rem', color: 'var(--danger)' }}>🔌</span>
                  <div>
                    <strong style={{ color: '#fff' }}>Uninterrupted Assessment:</strong>
                    <br />
                    Once you start the assessment, the timer continues. Ensure you have power backups and a robust internet connection.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.8rem 1.8rem' }}
              onClick={() => window.navigateTo('/student/dashboard')}
            >
              Cancel & Exit
            </button>
            <button 
              className="btn btn-primary" 
              style={{ padding: '0.85rem 2.2rem', fontWeight: 800, fontSize: '1rem', opacity: isStartEnabled ? 1 : 0.4, cursor: isStartEnabled ? 'pointer' : 'not-allowed' }} 
              disabled={!isStartEnabled}
              onClick={handleStartExam}
            >
              🔒 Enter Fullscreen & Start Technical Assessment
            </button>
          </div>

        </div>
      </div>
    );
  }

  if (examSubmitted) {
    const showScorecard = evaluationResult !== null;
    const totalScore = showScorecard ? evaluationResult.mcq_score : 0;
    const totalMax = showScorecard ? evaluationResult.mcq_total : 0;
    const percent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
    const isRecommended = percent >= 60;
    const compliancePassed = showScorecard ? (evaluationResult.tab_switches <= MAX_WARNINGS && !isAutoSubmit) : true;

    return (
      <div className="flex-center" style={{ minHeight: '100vh', padding: '2rem' }}>
        <div className="glass-card" style={{ maxWidth: '650px', width: '100%', padding: '2.5rem', border: '1px solid var(--border-glass)', borderRadius: '16px', animation: 'scaleIn 0.5s ease-out' }}>
          {isAutoSubmit && (
            <div className="badge badge-danger" style={{ display: 'block', padding: '0.85rem', marginBottom: '1.5rem', textTransform: 'none', fontSize: '0.88rem', textAlign: 'center' }}>
              ⚠️ {submitReason || 'Exam was auto-submitted due to a security violation.'}
            </div>
          )}

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '0.5rem' }}>🏆</span>
            <h2 className="text-gradient" style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem' }}>Technical Round Completed</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>Your responses have been evaluated and recorded securely.</p>
          </div>

          {showScorecard ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Assessment Verdict</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: isRecommended && compliancePassed ? 'var(--success)' : 'var(--warning)', marginTop: '0.2rem' }}>
                    {isAutoSubmit ? '🔴 DISQUALIFIED' : (!compliancePassed ? '⚠️ COMPLIANCE HOLD' : (isRecommended ? '🟢 HIGHLY RECOMMENDED' : '🟡 UNDER REVIEW'))}
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-glass)', padding: '1.25rem', borderRadius: '12px' }}>
                <h4 style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', marginBottom: '0.75rem' }}>🛡️ Compliance Auditing Summary:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Proctoring Violations Detected:</span>
                    <span style={{ fontWeight: 700, color: evaluationResult.tab_switches > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {evaluationResult.tab_switches} switch(es)
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Anti-Cheating Environment Status:</span>
                    <span style={{ fontWeight: 700, color: compliancePassed ? 'var(--success)' : 'var(--danger)' }}>
                      {compliancePassed ? 'Verified Compliance ✔' : 'Security Flagged ✘'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Execution Security Log:</span>
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>Sandboxed (Secure)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', fontSize: '0.95rem' }}>
              <p>Evaluating answers and compiling test reports...</p>
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.8rem 1.5rem', fontWeight: 700 }} onClick={() => window.navigateTo('/student/dashboard')}>
            Return to Student Dashboard
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

            {/* Nav controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
              <button
                className="btn btn-secondary"
                disabled={currentQ === 0}
                onClick={() => setCurrentQ(currentQ - 1)}
                style={{ visibility: currentQ === 0 ? 'hidden' : 'visible' }}
              >
                ← Previous
              </button>
              
              {currentQ === questions.length - 1 && !!answers[currentQuestion.id] ? (
                <button className="btn btn-primary" onClick={submitExamManual} style={{ padding: '0.8rem 2.2rem', fontWeight: 800 }}>
                  📤 Submit Exam
                </button>
              ) : (
                currentQ < questions.length - 1 && !!answers[currentQuestion.id] && (
                  <button
                    className="btn btn-primary"
                    onClick={() => setCurrentQ(currentQ + 1)}
                    style={{ padding: '0.8rem 2.2rem', fontWeight: 800 }}
                  >
                    Next →
                  </button>
                )
              )}
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
            Violation count: {tabSwitchCount} / {MAX_WARNINGS}
          </p>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 2rem', lineHeight: '1.6' }}>
            Attention: You are not allowed to navigate away from the exam. Your activity is being monitored.
            {tabSwitchCount < MAX_WARNINGS ? (
              <strong style={{ color: 'var(--warning)', display: 'block', marginTop: '0.5rem' }}>
                You have {MAX_WARNINGS - tabSwitchCount} warning(s) remaining before automatic submission.
              </strong>
            ) : (
              <strong style={{ color: 'var(--danger)', display: 'block', marginTop: '0.5rem', fontSize: '1.25rem' }}>
                FINAL WARNING: NEXT DETECTED TAB SWITCH WILL FORCE AUTO-SUBMISSION!
              </strong>
            )}
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
