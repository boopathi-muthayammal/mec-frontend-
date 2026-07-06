import React, { useState, useEffect } from 'react';
import Watermark from '../components/Watermark';

function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('exams'); // exams, results
  const [studentUser, setStudentUser] = useState(null);
  
  // Available Exams State
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);

  // My Results State
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState(null);

  // Resume exam state (if student was mid-exam when session expired)
  const [resumeExam, setResumeExam] = useState(null); // { examId, questionIndex }

  // Detailed Result Modal State
  const [showResultModal, setShowResultModal] = useState(false);
  const [detailedResult, setDetailedResult] = useState(null);
  const [loadingDetailedResult, setLoadingDetailedResult] = useState(false);

  // Check auth and load info
  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (studentUser) {
      if (activeTab === 'exams') {
        loadExams();
      } else {
        loadResults();
      }
    }
  }, [activeTab, studentUser]);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/check-session');
      const data = await res.json();
      if (data.success && data.role === 'student') {
        setStudentUser(data.user);
        // Check if student was mid-exam when session expired
        // Pass the current student's ID so we only resume their own exam
        detectInProgressExam(data.user.id || data.user._id);
      } else {
        window.navigateTo('/student/login');
      }
    } catch (err) {
      window.navigateTo('/student/login');
    }
  };

  const detectInProgressExam = (currentStudentId) => {
    try {
      // Look for any exam_*_progress in localStorage that has isStarted=true
      // AND belongs to the currently logged-in student (to avoid cross-account resume)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('exam_') && key.endsWith('_progress')) {
          const val = localStorage.getItem(key);
          if (!val) continue;
          const parsed = JSON.parse(val);
          if (parsed && parsed.isStarted && parsed.examId) {
            // Only resume if the progress was saved by the same student
            if (currentStudentId && parsed.studentId && parsed.studentId !== currentStudentId) {
              // This progress belongs to a different student — clear it
              try { localStorage.removeItem(key); } catch(e) {}
              continue;
            }
            setResumeExam({ examId: parsed.examId, questionIndex: parsed.currentQ || 0 });
            break;
          }
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    // Clear all exam progress from localStorage on logout
    // so another student logging in on the same browser won't see a stale Resume banner
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('exam_') && key.endsWith('_progress')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    window.navigateTo('/student/login');
  };

  const loadExams = async () => {
    setLoadingExams(true);
    try {
      const res = await fetch('/api/student/exams');
      const data = await res.json();
      if (data.success) {
        setExams(data.exams);
      }
    } catch (err) {
      console.error('Error loading student exams:', err);
    } finally {
      setLoadingExams(false);
    }
  };

  const loadResults = async () => {
    setLoadingResults(true);
    try {
      const res = await fetch('/api/student/results');
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
      }
    } catch (err) {
      console.error('Error loading student results:', err);
    } finally {
      setLoadingResults(false);
    }
  };

  const openStartModal = (examId) => {
    setSelectedExamId(examId);
    setShowModal(true);
  };

  const closeStartModal = () => {
    setShowModal(false);
    setSelectedExamId(null);
  };

  const confirmStartExam = () => {
    if (selectedExamId) {
      window.navigateTo('/student/exam', `id=${selectedExamId}`);
    }
  };

  const handleViewResult = async (resultId) => {
    setLoadingDetailedResult(true);
    setShowResultModal(true);
    setDetailedResult(null);
    try {
      const res = await fetch(`/api/student/results/${resultId}/detailed`);
      const data = await res.json();
      if (data.success) {
        setDetailedResult(data);
      } else {
        alert(data.message || 'Failed to fetch detailed results');
        setShowResultModal(false);
      }
    } catch (err) {
      console.error('Error fetching detailed results:', err);
      alert('Network error fetching results.');
      setShowResultModal(false);
    } finally {
      setLoadingDetailedResult(false);
    }
  };

  return (
    <>
      <Watermark text={studentUser ? `${studentUser.roll_number} ${studentUser.name}` : ''} />
      <div className="dashboard">
      {/* Top Navbar */}
      <nav className="navbar">
        <div className="nav-brand">
          <span>🛡️</span>
          <span className="text-gradient">ExamGuard Portal</span>
        </div>
        {studentUser && (
          <div className="nav-user">
            <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{studentUser.name}</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>({studentUser.roll_number})</span>
            <button className="btn btn-danger" style={{ padding: '0.45rem 1.2rem', fontSize: '0.85rem' }} onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </nav>

      <div className="container">
        {/* Welcome Section */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
            Welcome back, {studentUser ? studentUser.name.split(' ')[0] : 'Student'}!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Check your scheduled exams or review previous results below.
          </p>
        </div>

        {/* Resume Exam Banner */}
        {resumeExam && (
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.45)', borderRadius: '14px', padding: '1rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <span style={{ fontSize: '1.6rem' }}>⏸️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.95rem' }}>Exam In Progress!</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
                  You were in the middle of an exam when your session ended. Your answers have been saved.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', flexShrink: 0 }}>
              <button
                className="btn btn-success"
                style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 700 }}
                onClick={() => {
                  window.navigateTo('/student/exam', `id=${resumeExam.examId}&resume=1`);
                }}
              >
                ▶ Resume Exam
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                onClick={() => {
                  // Dismiss: clear the saved progress for this exam
                  try { localStorage.removeItem(`exam_${resumeExam.examId}_progress`); } catch(e){}
                  setResumeExam(null);
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}


        {/* Tab Selection */}
        <div className="tabs-nav">
          <button className={`tab-btn ${activeTab === 'exams' ? 'active' : ''}`} onClick={() => setActiveTab('exams')}>
            📝 Available Exams
          </button>
          <button className={`tab-btn ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>
            📊 My Results
          </button>
        </div>

        {/* EXAMS PANEL */}
        {activeTab === 'exams' && (
          <div>
            {loadingExams ? (
              <div className="flex-center" style={{ padding: '4rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Loading examinations...</p>
              </div>
            ) : exams.length === 0 ? (
              <div className="glass-card flex-center" style={{ padding: '4rem', flexDirection: 'column', color: 'var(--text-secondary)' }}>
                <span style={{ fontSize: '3rem' }}>📋</span>
                <h3 style={{ color: '#fff', marginTop: '1rem', marginBottom: '0.25rem' }}>No Exams Scheduled</h3>
                <p style={{ fontSize: '0.9rem' }}>There are currently no active exams available for you.</p>
              </div>
            ) : (
              <div className="cards-grid">
                {exams.map(exam => (
                  <div key={exam.id} className="glass-card dashboard-card">
                    <div className="card-header">
                      <h3 className="card-title">{exam.title}</h3>
                    </div>
                    <p className="card-description">
                      {exam.description || 'Please click start to read the examination guidelines.'}
                    </p>
                    <div className="card-meta">
                      <span>⏱️ {exam.duration_minutes || exam.duration} Min</span>
                      <span>❓ {exam.question_count || '—'} Questions</span>
                    </div>

                    {exam.already_taken && exam.new_question_count > 0 ? (
                      <div>
                        <div className="badge badge-warning flex-center" style={{ padding: '0.5rem', borderRadius: '8px 8px 0 0', fontSize: '0.82rem', gap: '0.3rem' }}>
                          ⚠️ {exam.new_question_count} New Question{exam.new_question_count > 1 ? 's' : ''} Added!
                        </div>
                        <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center', borderRadius: '0 0 8px 8px', borderTop: 'none' }} onClick={() => openStartModal(exam.id)}>
                          Answer New Questions →
                        </button>
                      </div>
                    ) : exam.already_taken ? (
                      <div className="badge badge-success flex-center" style={{ padding: '0.65rem', borderRadius: '10px', fontSize: '0.88rem' }}>
                        Completed ✓
                      </div>
                    ) : !exam.question_count ? (
                      <div className="badge badge-danger flex-center" style={{ padding: '0.65rem', borderRadius: '10px', fontSize: '0.88rem', textTransform: 'none' }}>
                        No questions added yet ⚠️
                      </div>
                    ) : (
                      <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center' }} onClick={() => openStartModal(exam.id)}>
                        Start Exam →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RESULTS PANEL */}
        {activeTab === 'results' && (
          <div>
            {loadingResults ? (
              <div className="flex-center" style={{ padding: '4rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Loading results...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="glass-card flex-center" style={{ padding: '4rem', flexDirection: 'column', color: 'var(--text-secondary)' }}>
                <span style={{ fontSize: '3rem' }}>📊</span>
                <h3 style={{ color: '#fff', marginTop: '1rem', marginBottom: '0.25rem' }}>No Submissions Yet</h3>
                <p style={{ fontSize: '0.9rem' }}>You have not completed any exams in this portal yet.</p>
              </div>
            ) : (
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <div className="table-wrapper">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Exam Title</th>
                        <th>Marks</th>
                        <th>Status</th>
                        <th>Submission Time</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map(r => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600 }}>{r.exam_title}</td>
                          <td>
                            {r.released ? (
                              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{r.mcq_score} / {r.mcq_total}</span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>🔒 Locked</span>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-success">✅ Submitted</span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>
                            {new Date(r.submitted_at).toLocaleString()}
                          </td>
                          <td>
                            {r.released ? (
                              <button className="btn btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', borderRadius: '6px' }} onClick={() => handleViewResult(r.id)}>
                                👁️ View Result
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Awaiting Release</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONFIRMATION BEFORE EXAM MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={closeStartModal}>
          <div className="glass-card modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '3rem' }}>🚀</span>
              <h3 className="modal-title" style={{ marginTop: '0.5rem', fontSize: '1.4rem' }}>Are you ready to begin?</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="badge badge-danger" style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', width: '100%', fontSize: '0.85rem', textTransform: 'none', justifyContent: 'flex-start' }}>
                <span>⚠️</span>
                <span>Do NOT switch tabs. Switching tabs will trigger auto-submission of your exam.</span>
              </div>
              <div className="badge badge-danger" style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', width: '100%', fontSize: '0.85rem', textTransform: 'none', justifyContent: 'flex-start' }}>
                <span>⚠️</span>
                <span>The exam is timed. You cannot pause the timer once it has started.</span>
              </div>
              <div className="badge badge-warning" style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', width: '100%', fontSize: '0.85rem', textTransform: 'none', justifyContent: 'flex-start', color: 'var(--warning)' }}>
                <span>⚠️</span>
                <span>You must attempt this exam in a full-screen environment.</span>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeStartModal}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={confirmStartExam}>
                Confirm & Start
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED RESULT MODAL */}
      {showResultModal && (
        <div className="modal-overlay" onClick={() => setShowResultModal(false)}>
          <div className="glass-card modal-box" style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                {detailedResult ? `${detailedResult.exam_title} - Results` : 'Loading Results...'}
              </h3>
              <button className="btn btn-secondary" onClick={() => setShowResultModal(false)} style={{ padding: '0.4rem 0.8rem' }}>Close</button>
            </div>
            
            {loadingDetailedResult ? (
              <div className="flex-center" style={{ padding: '3rem' }}>
                <p>Loading your answers...</p>
              </div>
            ) : detailedResult ? (
              <div>
                <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', textAlign: 'center', background: 'rgba(99, 102, 241, 0.1)' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {detailedResult.total_score} / {detailedResult.total_possible}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Total Score</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {detailedResult.details.map((q, idx) => (
                    <div key={q.question_id} className="glass-card dashboard-card" style={{ padding: '1.25rem', borderLeft: `4px solid ${q.is_correct ? 'var(--success)' : 'var(--danger)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <h4 style={{ fontWeight: 700, fontSize: '1.05rem', margin: 0 }}>Question {idx + 1}</h4>
                        <span className={`badge ${q.is_correct ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', textTransform: 'none' }}>
                          {q.is_correct ? `+${q.total_marks} Marks` : '0 Marks'}
                        </span>
                      </div>
                      <p style={{ marginBottom: '1rem', whiteSpace: 'pre-wrap', lineHeight: '1.5', color: '#e2e8f0' }}>{q.question_text}</p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Your Answer: </span>
                          <strong style={{ color: q.is_correct ? 'var(--success)' : 'var(--danger)' }}>
                            {q.student_answer !== 'Not Answered' ? `${q.student_answer}. ${q.options[q.student_answer]}` : 'Not Answered'}
                          </strong>
                        </div>
                        {!q.is_correct && (
                          <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Correct Answer: </span>
                            <strong style={{ color: 'var(--success)' }}>
                              {q.correct_option}. {q.options[q.correct_option]}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-center" style={{ padding: '3rem' }}>
                <p>Failed to load detailed results.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}

export default StudentDashboard;
