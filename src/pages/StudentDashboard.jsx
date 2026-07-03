import React, { useState, useEffect } from 'react';

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
      } else {
        window.navigateTo('/student/login');
      }
    } catch (err) {
      window.navigateTo('/student/login');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
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

  return (
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

                    {exam.already_taken ? (
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
                        <th>Status</th>
                        <th>Submission Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map(r => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600 }}>{r.exam_title}</td>
                          <td>
                            <span className="badge badge-success">✅ Submitted</span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>
                            {new Date(r.submitted_at).toLocaleString()}
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
    </div>
  );
}

export default StudentDashboard;
