import React, { useState, useEffect, useRef } from 'react';

const templates = {
  javascript: `// Write your JavaScript (NodeJS) code here
const fs = require('fs');

function solve() {
    const input = fs.readFileSync(0, 'utf-8').trim();
    if (!input) return;
    
    // Implement your logic here
    console.log("Hello World");
}

solve();`,
  python: `# Write your Python code here
import sys

def solve():
    # Read lines from standard input
    lines = sys.stdin.read().splitlines()
    if not lines:
        return
        
    # Implement your logic here
    print("Hello World")

if __name__ == '__main__':
    solve()`,
  c: `// Write your C (GCC) code here
#include <stdio.h>
#include <stdlib.h>

int main() {
    // Read from standard input and implement your logic
    // printf("Hello World\\n");
    return 0;
}`
};

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

  // Timer States
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const timerIntervalRef = useRef(null);

  // Anti-Cheat States
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarningOverlay, setShowWarningOverlay] = useState(false);
  const isProcessingViolationRef = useRef(false);

  const MAX_WARNINGS = 1; // 2nd violation auto-submits

  const hasLoadedRef = useRef(false);

  // Code execution states
  const [codeLanguages, setCodeLanguages] = useState({}); // qId -> lang
  const [runningCode, setRunningCode] = useState(false);
  const [runResults, setRunResults] = useState({}); // qId -> test case results array
  const [customInputs, setCustomInputs] = useState({}); // qId -> custom stdin input
  const [runningCustomCode, setRunningCustomCode] = useState(false);
  const [customRunResults, setCustomRunResults] = useState({}); // qId -> custom execution result object
  const [showCustomInput, setShowCustomInput] = useState({}); // qId -> bool

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

  useEffect(() => {
    if (questions && questions[currentQ] && questions[currentQ].question_type === 'PROGRAM') {
      const qId = questions[currentQ].id;
      // Initialize language if not set
      if (!codeLanguages[qId]) {
        setCodeLanguages(prev => ({ ...prev, [qId]: 'javascript' }));
      }
      // Seed template if answer is empty
      const currentCode = answers[qId] || '';
      if (!currentCode.trim()) {
        const lang = codeLanguages[qId] || 'javascript';
        setAnswers(prev => ({ ...prev, [qId]: templates[lang] }));
      }
    }
  }, [currentQ, questions]);

  // Load questions and details
  const loadExamData = async () => {
    try {
      const res = await fetch(`/api/student/exams/${examId}/start`);
      const data = await res.json();
      if (data.success) {
        setExam(data.exam);
        setQuestions(data.questions);
        setTimeLeft(data.exam.duration_minutes * 60);
        
      } else {
        setError(data.message || 'Cannot start exam');
      }
    } catch (err) {
      setError('Error loading exam. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = () => {
    requestFullscreen();
    startTimer(timeLeft);
    enableAntiCheat();
    setIsStarted(true);
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

  const handleRunCode = async (qId) => {
    const code = answers[qId] || '';
    if (!code.trim()) {
      alert('Please write some code before running tests.');
      return;
    }
    const lang = codeLanguages[qId] || 'javascript';
    setRunningCode(true);
    try {
      const res = await fetch('/api/student/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: qId, code, language: lang })
      });
      const data = await res.json();
      if (data.success) {
        setRunResults((prev) => ({ ...prev, [qId]: data.results }));
      } else {
        alert(data.message || 'Error running code.');
      }
    } catch (err) {
      alert('Network error executing code. Please try again.');
    } finally {
      setRunningCode(false);
    }
  };

  const handleRunCustomCode = async (qId) => {
    const code = answers[qId] || '';
    if (!code.trim()) {
      alert('Please write some code before running custom tests.');
      return;
    }
    const lang = codeLanguages[qId] || 'javascript';
    const customInput = customInputs[qId] || '';
    setRunningCustomCode(true);
    setCustomRunResults((prev) => ({ ...prev, [qId]: null }));
    try {
      const res = await fetch('/api/student/run-custom-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: lang, customInput })
      });
      const data = await res.json();
      if (data.success) {
        setCustomRunResults((prev) => ({
          ...prev,
          [qId]: {
            status: data.status,
            stdout: data.stdout,
            error_message: data.error_message
          }
        }));
      } else {
        alert(data.message || 'Error running custom code.');
      }
    } catch (err) {
      alert('Network error executing custom code. Please try again.');
    } finally {
      setRunningCustomCode(false);
    }
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
          languages: codeLanguages,
          tab_switches: tabSwitchCount + (isAuto && reason.includes('Tab') ? 1 : 0),
          auto_submitted: isAuto
        })
      });
      const data = await res.json();
      if (data.success) {
        setEvaluationResult(data.evaluation);
      } else {
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

  if (!isStarted) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', padding: '2rem' }}>
        <div className="glass-card" style={{ maxWidth: '600px', width: '100%', padding: '2.5rem', border: '1px solid var(--border-glass)', borderRadius: '16px' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '3.5rem' }}>🛡️</span>
            <h2 className="text-gradient" style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem' }}>ExamGuard Secure Environment</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Technical Round Assessment: <strong>{exam && exam.title}</strong></p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1.25rem', marginBottom: '2rem' }}>
            <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: '0.75rem' }}>🚨 Mandatory Compliance Rules:</h4>
            <ul style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', paddingLeft: '1.2rem', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>This examination uses <strong>Strict Fullscreen Proctoring</strong>.</li>
              <li>Leaving fullscreen mode or switching tabs will log a security violation.</li>
              <li>A maximum of <strong>1 warning</strong> is permitted. A second violation will result in <strong>automatic exam submission</strong>.</li>
              <li>Right-clicking, copying, pasting, or standard developer key shortcuts are strictly disabled.</li>
              <li>Ensure your internet connection is stable before proceeding.</li>
            </ul>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              ⏱️ Duration: <strong>{exam && exam.duration_minutes} Minutes</strong> &nbsp;|&nbsp; ❓ Total Questions: <strong>{questions.length}</strong>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem 1.5rem', fontWeight: 700, fontSize: '1rem' }} onClick={handleStartExam}>
              🔒 Enter Fullscreen & Start Technical Round
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (examSubmitted) {
    const showScorecard = evaluationResult !== null;
    const totalScore = showScorecard ? (evaluationResult.mcq_score + evaluationResult.program_score) : 0;
    const totalMax = showScorecard ? (evaluationResult.mcq_total + evaluationResult.program_total) : 0;
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
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Overall Match</span>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', marginTop: '0.2rem' }}>{percent}%</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-glass)', padding: '1.25rem', borderRadius: '12px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                    <span>MCQ Section</span>
                    <span style={{ color: '#fff', fontWeight: 700 }}>{evaluationResult.mcq_score} / {evaluationResult.mcq_total}</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', marginTop: '0.75rem', overflow: 'hidden' }}>
                    <div style={{ width: `${evaluationResult.mcq_total > 0 ? (evaluationResult.mcq_score / evaluationResult.mcq_total) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--primary))', borderRadius: '3px' }}></div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-glass)', padding: '1.25rem', borderRadius: '12px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Coding Section</span>
                    <span style={{ color: '#fff', fontWeight: 700 }}>{evaluationResult.program_score} / {evaluationResult.program_total}</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', marginTop: '0.75rem', overflow: 'hidden' }}>
                    <div style={{ width: `${evaluationResult.program_total > 0 ? (evaluationResult.program_score / evaluationResult.program_total) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, #00e676, var(--primary))', borderRadius: '3px' }}></div>
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

            {currentQuestion.question_type === 'PROGRAM' ? (
              <div className="programming-layout">
                {/* Left Side: Question Instructions & Test Cases */}
                <div className="left-panel">
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#fff' }}>Question Description</h4>
                    <div className="question-text" style={{ fontSize: '1.05rem', lineHeight: '1.6' }}>
                      {currentQuestion.question_text}
                    </div>
                  </div>

                  {currentQuestion.test_cases && currentQuestion.test_cases.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#fff' }}>Public Test Cases</h4>
                      <div className="tc-grid">
                        {currentQuestion.test_cases.filter(tc => tc.is_public).map((tc, idx) => (
                          <div key={tc.id || idx} className="tc-row">
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Case #{idx + 1}</span>
                            <div style={{ marginTop: '0.4rem' }}>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Input:</span>
                              <div className="tc-content-box">{tc.input || 'None (no stdin input)'}</div>
                            </div>
                            <div style={{ marginTop: '0.4rem' }}>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Expected Output:</span>
                              <div className="tc-content-box">{tc.expected_output}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side: Code Editor Workspace & Test Executor */}
                <div className="right-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>Select Language</label>
                    <select
                      className="form-input"
                      style={{ width: '150px', padding: '0.45rem 0.75rem', fontSize: '0.88rem' }}
                      value={codeLanguages[currentQuestion.id] || 'javascript'}
                      onChange={(e) => {
                        const newLang = e.target.value;
                        setCodeLanguages({ ...codeLanguages, [currentQuestion.id]: newLang });
                        const currentCode = answers[currentQuestion.id] || '';
                        if (!currentCode.trim() || Object.values(templates).some(t => t.trim() === currentCode.trim())) {
                          setAnswers(prev => ({ ...prev, [currentQuestion.id]: templates[newLang] }));
                        }
                      }}
                    >
                      <option value="javascript">JavaScript (NodeJS)</option>
                      <option value="python">Python</option>
                      <option value="c">C (GCC Compiler)</option>
                    </select>
                  </div>

                  <textarea
                    className="code-textarea"
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleTextChange(currentQuestion.id, e.target.value)}
                    placeholder={
                      (codeLanguages[currentQuestion.id] || 'javascript') === 'c'
                        ? '#include <stdio.h>\n\nint main() {\n    // read from stdin (e.g. scanf)\n    // write to stdout (e.g. printf)\n    return 0;\n}'
                        : (codeLanguages[currentQuestion.id] || 'javascript') === 'python'
                        ? '# read from stdin using input() or sys.stdin.read()\n# print to stdout using print()'
                        : '// read from stdin using fs.readFileSync(0, \'utf-8\')\nconst fs = require(\'fs\');'
                    }
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '1rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={runningCode || runningCustomCode}
                      style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem', gap: '0.5rem' }}
                      onClick={() => handleRunCode(currentQuestion.id)}
                    >
                      {runningCode ? '⏳ Running Tests...' : '⚙️ Run Test Cases'}
                    </button>
                    
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}
                      onClick={() => setShowCustomInput(prev => ({ ...prev, [currentQuestion.id]: !prev[currentQuestion.id] }))}
                    >
                      {showCustomInput[currentQuestion.id] ? '✕ Hide Custom Input' : '⌨️ Custom Input'}
                    </button>
                  </div>

                  {/* Custom Input Console */}
                  {showCustomInput[currentQuestion.id] && (
                    <div className="glass-card" style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--border-glass)', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', color: '#fff' }}>Custom Test Input (stdin)</div>
                      <textarea
                        className="form-input"
                        rows="3"
                        style={{ fontFamily: 'Courier New, monospace', fontSize: '0.88rem', background: '#05050f', border: '1px solid var(--border-glass)', color: '#fff', padding: '0.5rem', width: '100%', resize: 'vertical' }}
                        value={customInputs[currentQuestion.id] || ''}
                        onChange={(e) => setCustomInputs({ ...customInputs, [currentQuestion.id]: e.target.value })}
                        placeholder="Provide standard input lines here..."
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                          disabled={runningCustomCode}
                          onClick={() => handleRunCustomCode(currentQuestion.id)}
                        >
                          {runningCustomCode ? '⏳ Executing...' : '▶️ Run Custom Code'}
                        </button>
                      </div>

                      {customRunResults[currentQuestion.id] && (
                        <div style={{ marginTop: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Execution Output:</span>
                            <span className={`badge ${customRunResults[currentQuestion.id].status === 'success' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                              {customRunResults[currentQuestion.id].status.toUpperCase()}
                            </span>
                          </div>
                          
                          {customRunResults[currentQuestion.id].error_message ? (
                            <div className="tc-content-box" style={{ color: 'var(--danger)', background: 'rgba(255, 82, 82, 0.08)', fontFamily: 'Courier New, monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                              {customRunResults[currentQuestion.id].error_message}
                            </div>
                          ) : (
                            <div className="tc-content-box" style={{ color: '#00e676', background: '#020208', fontFamily: 'Courier New, monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                              {customRunResults[currentQuestion.id].stdout || '(No output printed to stdout)'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Execution Results Console */}
                  {runResults[currentQuestion.id] && (
                    <div className="results-console">
                      <div className="console-title">
                        <span>🖥️</span> Execution Results
                      </div>
                      <div className="tc-grid">
                        {runResults[currentQuestion.id].map((res, idx) => {
                          const isPass = res.status === 'pass';
                          const statusColor = isPass ? 'var(--success)' : 'var(--danger)';
                          return (
                            <div key={res.id || idx} className="tc-row" style={{ borderLeft: `4px solid ${statusColor}` }}>
                              <div className="tc-header">
                                <span style={{ fontWeight: 600 }}>Test Case #{idx + 1} ({res.is_public ? 'Public' : 'Hidden'})</span>
                                <span className={`badge ${isPass ? 'badge-success' : 'badge-danger'}`}>
                                  {res.status.toUpperCase()}
                                </span>
                              </div>

                              {res.is_public ? (
                                <div style={{ fontSize: '0.85rem' }}>
                                  <div style={{ marginTop: '0.4rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Input:</span>
                                    <div className="tc-content-box">{res.input || 'None'}</div>
                                  </div>
                                  <div style={{ marginTop: '0.4rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Expected Output:</span>
                                    <div className="tc-content-box">{res.expected_output}</div>
                                  </div>
                                  <div style={{ marginTop: '0.4rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Actual Output:</span>
                                    <div className="tc-content-box" style={{ color: isPass ? '#fff' : 'var(--danger)' }}>
                                      {res.actual_output || '(No stdout output)'}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                  Hidden testcase input/output details are masked for cheating prevention.
                                </div>
                              )}

                              {res.error_message && (
                                <div style={{ marginTop: '0.5rem' }}>
                                  <span style={{ color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600 }}>Error Details:</span>
                                  <div className="tc-content-box" style={{ color: 'var(--danger)', background: 'rgba(255, 82, 82, 0.08)' }}>
                                    {res.error_message}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
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
