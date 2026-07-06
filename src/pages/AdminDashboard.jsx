import React, { useState, useEffect } from 'react';

const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};


function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview'); // overview, students, exams, reports
  const [adminUser, setAdminUser] = useState(null);

  // Reports Tab State
  const [reportsYear, setReportsYear] = useState(1);
  const [reportsSection, setReportsSection] = useState('A');
  const [reportsExamId, setReportsExamId] = useState('');
  const [classReport, setClassReport] = useState([]);
  const [reportExamTitle, setReportExamTitle] = useState('');
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsMessage, setReportsMessage] = useState('');

  
  // Overview Stats
  const [stats, setStats] = useState({ totalExams: 0, totalStudents: 0, totalResults: 0 });
  const [recentResults, setRecentResults] = useState([]);

  // Students Tab State
  const [students, setStudents] = useState([]);
  const [filterYear, setFilterYear] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [studentForm, setStudentForm] = useState({ roll_number: '', name: '', dob: '', year: 1, section: 'A' });
  const [csvFile, setCsvFile] = useState(null);
  const [csvYear, setCsvYear] = useState(1);
  const [csvSection, setCsvSection] = useState('A');
  const [studentMessage, setStudentMessage] = useState({ type: '', text: '', errors: [] });
  const [previewStudents, setPreviewStudents] = useState([]); // In-memory student records parsed from spreadsheet

  // Exams Tab State
  const [exams, setExams] = useState([]);
  const [examForm, setExamForm] = useState({
    title: '',
    description: '',
    duration_minutes: 30,
    target_years: [1, 2, 3, 4],
    target_sections: ['A', 'B', 'C', 'D', 'E'],
    exam_date: getTodayDateString()
  });
  const [selectedExam, setSelectedExam] = useState(null); // When viewing questions for an exam
  const [editingExamId, setEditingExamId] = useState(null); // ID of the exam currently being edited

  // Question Management State
  const [questions, setQuestions] = useState([]);
  const [questionForm, setQuestionForm] = useState({
    question_type: 'MCQ',
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    marks: 1
  });
  const [testCases, setTestCases] = useState([{ input: '', expected_output: '', is_public: true }]);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [examMessage, setExamMessage] = useState({ type: '', text: '' });

  // Student Program Answer State
  const [activeResultAnswers, setActiveResultAnswers] = useState(null); // { student, answers }
  const [viewingAnswersModal, setViewingAnswersModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Authentication & Initial Load
  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') {
      loadDashboardData();
    } else if (activeTab === 'students') {
      loadStudents();
    } else if (activeTab === 'exams') {
      loadExams();
    } else if (activeTab === 'reports') {
      loadExams();
    }
  }, [activeTab, filterYear, filterSection]);

  useEffect(() => {
    if (activeTab === 'reports' && reportsExamId && reportsYear && reportsSection) {
      loadClassReport();
    }
  }, [activeTab, reportsExamId, reportsYear, reportsSection]);

  const loadClassReport = async () => {
    if (!reportsExamId || !reportsYear || !reportsSection) return;
    setReportsLoading(true);
    setReportsMessage('');
    try {
      const res = await fetch(`/api/admin/results/class-report?exam_id=${reportsExamId}&year=${reportsYear}&section=${reportsSection}`);
      const data = await res.json();
      if (data.success) {
        setClassReport(data.report);
        setReportExamTitle(data.exam_title);
      } else {
        setReportsMessage(data.message || 'Failed to fetch report.');
        setClassReport([]);
      }
    } catch (err) {
      console.error('Error loading report:', err);
      setReportsMessage('Error loading report data.');
      setClassReport([]);
    } finally {
      setReportsLoading(false);
    }
  };


  const showConfirm = (title, message, onConfirm) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/check-session');
      const data = await res.json();
      if (data.success && data.role === 'admin') {
        setAdminUser(data.user);
      } else {
        window.navigateTo('/admin/login');
      }
    } catch (err) {
      window.navigateTo('/admin/login');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    window.navigateTo('/admin/login');
  };

  // ==================== OVERVIEW SECTION ====================
  const loadDashboardData = async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setRecentResults(data.recentResults);
      }
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    }
  };

  // ==================== STUDENTS SECTION ====================
  const loadStudents = async () => {
    try {
      let url = '/api/admin/students';
      const params = [];
      if (filterYear) params.push(`year=${filterYear}`);
      if (filterSection) params.push(`section=${filterSection}`);
      if (params.length > 0) url += '?' + params.join('&');

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setStudents(data.students);
      }
    } catch (err) {
      console.error('Error loading students:', err);
    }
  };

  const downloadStudentsExcel = () => {
    const headers = ['Roll Number', 'Name', 'DOB', 'Year', 'Section', 'Exams Taken', 'Average Score'];
    const rows = students.map(s => [
      `"${s.roll_number}"`,
      `"${s.name}"`,
      `"${s.dob}"`,
      `"Yr ${s.year}"`,
      `"Sec ${s.section}"`,
      s.exams_taken,
      `"${s.average_score}%"`
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `registered_students_${filterYear ? 'Yr' + filterYear : 'AllYears'}_${filterSection ? 'Sec' + filterSection : 'AllSecs'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setStudentMessage({ type: '', text: '' });
    try {
      const res = await fetch('/api/admin/students/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentForm)
      });
      const data = await res.json();
      if (data.success) {
        setStudentMessage({ type: 'success', text: 'Student added successfully!' });
        setStudentForm({ roll_number: '', name: '', dob: '', year: 1, section: 'A' });
        loadStudents();
      } else {
        setStudentMessage({ type: 'danger', text: data.message || 'Failed to add student.' });
      }
    } catch (err) {
      setStudentMessage({ type: 'danger', text: 'Error adding student.' });
    }
  };

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) return;
    setStudentMessage({ type: '', text: '', errors: [] });
    setPreviewStudents([]);

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await fetch('/api/admin/students/parse', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setPreviewStudents(data.records);
        setStudentMessage({ 
          type: 'success', 
          text: `Loaded ${data.records.length} students from ${csvFile.name} successfully! Please review, edit, or delete rows below and click Save & Synchronize.`, 
          errors: [] 
        });
        setCsvFile(null);
        document.getElementById('csvFileInput').value = '';
      } else {
        setStudentMessage({ 
          type: 'danger', 
          text: data.message || 'Parsing failed.', 
          errors: [] 
        });
      }
    } catch (err) {
      setStudentMessage({ type: 'danger', text: 'Error parsing file.', errors: [] });
    }
  };

  const handleSaveRoster = async () => {
    if (previewStudents.length === 0) return;
    setStudentMessage({ type: '', text: '', errors: [] });

    // Validate that all fields are filled
    for (let i = 0; i < previewStudents.length; i++) {
      const s = previewStudents[i];
      if (!s.roll_number.trim() || !s.name.trim() || !s.dob.trim()) {
        setStudentMessage({
          type: 'danger',
          text: `⚠️ Row #${i + 1} has missing fields. Please ensure Roll Number, Student Name, and Date of Birth are completely filled in before saving!`,
          errors: []
        });
        return;
      }
    }

    try {
      const res = await fetch('/api/admin/students/save-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: csvYear,
          section: csvSection,
          students: previewStudents
        })
      });
      const data = await res.json();
      if (data.success) {
        setStudentMessage({ type: 'success', text: data.message, errors: [] });
        setPreviewStudents([]);
        setFilterYear(csvYear.toString());
        setFilterSection(csvSection.toUpperCase());
        loadStudents();
      } else {
        setStudentMessage({ type: 'danger', text: data.message || 'Failed to save roster.', errors: [] });
      }
    } catch (err) {
      setStudentMessage({ type: 'danger', text: 'Error saving roster.', errors: [] });
    }
  };

  const handlePreviewRowChange = (index, field, value) => {
    setPreviewStudents(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemovePreviewRow = (index) => {
    setPreviewStudents(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteStudent = (id) => {
    showConfirm(
      'Delete Student?',
      'Are you sure you want to delete this student? All their results and answers will be permanently removed.',
      async () => {
        try {
          const res = await fetch(`/api/admin/students/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            loadStudents();
          }
        } catch (err) {
          console.error('Error deleting student:', err);
        }
      }
    );
  };

  // ==================== EXAMS SECTION ====================
  const loadExams = async () => {
    try {
      const res = await fetch('/api/admin/exams');
      const data = await res.json();
      if (data.success) {
        setExams(data.exams);
      }
    } catch (err) {
      console.error('Error loading exams:', err);
    }
  };

  const startEditExam = (exam) => {
    setEditingExamId(exam.id || exam._id);
    setExamForm({
      title: exam.title,
      description: exam.description || '',
      duration_minutes: exam.duration_minutes || 30,
      target_years: exam.target_years || [1, 2, 3, 4],
      target_sections: exam.target_sections || ['A', 'B', 'C', 'D', 'E'],
      exam_date: exam.exam_date ? new Date(exam.exam_date).toISOString().substring(0, 10) : getTodayDateString()
    });
  };

  const cancelEditExam = () => {
    setEditingExamId(null);
    setExamForm({
      title: '',
      description: '',
      duration_minutes: 30,
      target_years: [1, 2, 3, 4],
      target_sections: ['A', 'B', 'C', 'D', 'E'],
      exam_date: getTodayDateString()
    });
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    setExamMessage({ type: '', text: '' });
    try {
      const url = editingExamId ? `/api/admin/exams/${editingExamId}` : '/api/admin/exams';
      const method = editingExamId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(examForm)
      });
      const data = await res.json();
      if (data.success) {
        setExamMessage({ 
          type: 'success', 
          text: editingExamId ? 'Exam updated successfully!' : 'Exam created successfully!' 
        });
        setEditingExamId(null);
        setExamForm({
          title: '',
          description: '',
          duration_minutes: 30,
          target_years: [1, 2, 3, 4],
          target_sections: ['A', 'B', 'C', 'D', 'E'],
          exam_date: getTodayDateString()
        });
        loadExams();
      } else {
        setExamMessage({ type: 'danger', text: data.message || 'Failed to save exam.' });
      }
    } catch (err) {
      setExamMessage({ type: 'danger', text: 'Error saving exam.' });
    }
  };

  const handleToggleExam = async (id) => {
    try {
      const res = await fetch(`/api/admin/exams/${id}/toggle`, { method: 'PUT' });
      const data = await res.json();
      if (data.success) {
        loadExams();
        if (selectedExam && selectedExam.id === id) {
          setSelectedExam(data.exam);
        }
      }
    } catch (err) {
      console.error('Error toggling exam:', err);
    }
  };

  const handleDeleteExam = (id) => {
    showConfirm(
      'Delete Exam?',
      'Are you sure you want to delete this exam? All questions, answers and results will be permanently removed.',
      async () => {
        try {
          const res = await fetch(`/api/admin/exams/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            loadExams();
            if (selectedExam && selectedExam.id === id) {
              setSelectedExam(null);
            }
          }
        } catch (err) {
          console.error('Error deleting exam:', err);
        }
      }
    );
  };

  const handleResetExam = (id) => {
    showConfirm(
      'Re-exam / Reset Results?',
      'Are you sure you want to reset this exam? This will delete all student answers, scorecards, and proctoring violation logs for this exam, allowing all students to retake it from scratch.',
      async () => {
        try {
          const res = await fetch(`/api/admin/exams/${id}/reset`, { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            alert('Exam results reset successfully! All students can now retake this exam.');
            loadExams();
          } else {
            alert(data.message || 'Failed to reset exam.');
          }
        } catch (err) {
          console.error('Error resetting exam:', err);
          alert('Network error resetting exam.');
        }
      }
    );
  };

  // ==================== QUESTIONS SECTION ====================
  const loadExamDetails = async (exam) => {
    try {
      const res = await fetch(`/api/admin/exams/${exam.id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedExam(data.exam);
        setQuestions(data.questions);
        setExtractedText('');
      }
    } catch (err) {
      console.error('Error loading exam details:', err);
    }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    setExamMessage({ type: '', text: '' });

    const payload = {
      ...questionForm,
      test_cases: questionForm.question_type === 'PROGRAM' ? testCases : []
    };

    try {
      const res = await fetch(`/api/admin/exams/${selectedExam.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setExamMessage({ type: 'success', text: 'Question added successfully!' });
        setQuestionForm({
          question_type: 'MCQ',
          question_text: '',
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
          correct_option: 'A',
          marks: 1
        });
        setTestCases([{ input: '', expected_output: '', is_public: true }]);
        loadExamDetails(selectedExam);
      } else {
        setExamMessage({ type: 'danger', text: data.message || 'Failed to add question.' });
      }
    } catch (err) {
      setExamMessage({ type: 'danger', text: 'Error adding question.' });
    }
  };

  const handleUploadQuestionsFile = async (e) => {
    e.preventDefault();
    if (!fileToUpload) return;
    setExamMessage({ type: '', text: '' });

    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      const res = await fetch(`/api/admin/exams/${selectedExam.id}/upload-questions`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setFileToUpload(null);
        document.getElementById('questionsFileInput').value = '';
        setExamMessage({ type: 'success', text: data.message });
        loadExamDetails(selectedExam); // Refresh lists automatically!
      } else {
        setExamMessage({ type: 'danger', text: data.message || 'Import failed.' });
      }
    } catch (err) {
      setExamMessage({ type: 'danger', text: 'Error importing questions from file.' });
    }
  };

  const handleDeleteQuestion = (id) => {
    showConfirm(
      'Delete Question?',
      'Are you sure you want to delete this question? This action cannot be undone.',
      async () => {
        try {
          const res = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            loadExamDetails(selectedExam);
          }
        } catch (err) {
          console.error('Error deleting question:', err);
        }
      }
    );
  };

  // ==================== VIEW STUDENT CODE SUBMISSIONS ====================
  const handleViewSubmissionAnswers = async (examId, studentId, studentName, rollNumber) => {
    try {
      const res = await fetch(`/api/admin/exams/${examId}/answers/${studentId}`);
      const data = await res.json();
      if (data.success) {
        setActiveResultAnswers({
          student: { name: studentName, roll_number: rollNumber },
          answers: data.answers
        });
        setViewingAnswersModal(true);
      }
    } catch (err) {
      console.error('Error fetching answers:', err);
    }
  };

  return (
    <div className="dashboard">
      {/* Fixed Navigation Topbar */}
      <nav className="navbar">
        <div className="nav-brand">
          <span>🛡️</span>
          <span className="text-gradient">ExamGuard Admin</span>
        </div>
        {adminUser && (
          <div className="nav-user">
            <span style={{ color: 'var(--text-secondary)' }}>{adminUser.username}</span>
            <button className="btn btn-danger" style={{ padding: '0.45rem 1.2rem', fontSize: '0.85rem' }} onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </nav>

      <div className="container">
        {/* Tab Switching Navigation */}
        <div className="tabs-nav no-print">
          <button className={`tab-btn ${activeTab === 'overview' && !selectedExam ? 'active' : ''}`} onClick={() => { setActiveTab('overview'); setSelectedExam(null); }}>
            📊 Overview
          </button>
          <button className={`tab-btn ${activeTab === 'students' && !selectedExam ? 'active' : ''}`} onClick={() => { setActiveTab('students'); setSelectedExam(null); }}>
            🎓 Students
          </button>
          <button className={`tab-btn ${activeTab === 'exams' || selectedExam ? 'active' : ''}`} onClick={() => { setActiveTab('exams'); }}>
            📝 Exams {selectedExam && `> ${selectedExam.title}`}
          </button>
          <button className={`tab-btn ${activeTab === 'reports' && !selectedExam ? 'active' : ''}`} onClick={() => { setActiveTab('reports'); setSelectedExam(null); }}>
            📈 Reports
          </button>
        </div>


        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && !selectedExam && (
          <div>
            <div className="stats-grid">
              <div className="glass-card stat-card">
                <div className="stat-icon">📋</div>
                <div className="stat-info">
                  <h3>Total Exams</h3>
                  <p>{stats.totalExams}</p>
                </div>
              </div>
              <div className="glass-card stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <h3>Total Students</h3>
                  <p>{stats.totalStudents}</p>
                </div>
              </div>
              <div className="glass-card stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <h3>Exams Attempted</h3>
                  <p>{stats.totalResults}</p>
                </div>
              </div>
            </div>

            <div className="glass-card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>Recent Submissions</h2>
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Roll Number</th>
                      <th>Exam</th>
                      <th>MCQ Score</th>
                      <th>Coding Score</th>
                      <th>Tabs Switched</th>
                      <th>Status</th>
                      <th>Submitted At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentResults.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                          No results submitted yet.
                        </td>
                      </tr>
                    ) : (
                      recentResults.map(r => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                          <td>{r.roll_number}</td>
                          <td>{r.exam_title}</td>
                          <td>{r.mcq_score} / {r.mcq_total}</td>
                          <td>{r.program_total > 0 ? `${r.program_score} / ${r.program_total}` : 'N/A'}</td>
                          <td style={{ color: r.tab_switches > 0 ? 'var(--danger)' : 'inherit', fontWeight: r.tab_switches > 0 ? 700 : 'normal' }}>
                            {r.tab_switches}
                          </td>
                          <td>
                            {r.auto_submitted ? (
                              <span className="badge badge-danger">⚠️ Auto Submit</span>
                            ) : (
                              <span className="badge badge-success">✅ Normal</span>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>
                            {new Date(r.submitted_at).toLocaleString()}
                          </td>
                          <td>
                            {r.program_submitted ? (
                              <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleViewSubmissionAnswers(r.exam_id, r.student_id || '', r.student_name, r.roll_number)}>
                                👁️ View Code
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No code</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === 'students' && !selectedExam && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              
              {/* Add Single Student */}
              <div className="glass-card no-print">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Add Single Student</h3>
                <form onSubmit={handleAddStudent}>
                  <div className="form-group">
                    <label className="form-label">Roll Number</label>
                    <input
                      type="text"
                      className="form-input"
                      value={studentForm.roll_number}
                      onChange={(e) => setStudentForm({ ...studentForm, roll_number: e.target.value })}
                      placeholder="e.g. 22CSE101"
                      style={{ textTransform: 'uppercase' }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      placeholder="e.g. John Doe"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      className="form-input"
                      value={studentForm.dob}
                      onChange={(e) => setStudentForm({ ...studentForm, dob: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Year</label>
                      <select
                        className="form-input"
                        value={studentForm.year}
                        onChange={(e) => setStudentForm({ ...studentForm, year: parseInt(e.target.value) })}
                      >
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Section</label>
                      <select
                        className="form-input"
                        value={['A', 'B', 'C', 'D', 'E'].includes(studentForm.section) ? studentForm.section : 'Custom'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Custom') {
                            setStudentForm({ ...studentForm, section: '' });
                          } else {
                            setStudentForm({ ...studentForm, section: val });
                          }
                        }}
                      >
                        <option value="A">Section A</option>
                        <option value="B">Section B</option>
                        <option value="C">Section C</option>
                        <option value="D">Section D</option>
                        <option value="E">Section E</option>
                        <option value="Custom">Custom...</option>
                      </select>
                      {!['A', 'B', 'C', 'D', 'E'].includes(studentForm.section) && (
                        <input
                          type="text"
                          className="form-input"
                          style={{ marginTop: '0.5rem', textTransform: 'uppercase' }}
                          placeholder="Type section..."
                          value={studentForm.section}
                          onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value.toUpperCase() })}
                          required
                        />
                      )}
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}>
                    ➕ Add Student
                  </button>
                </form>
              </div>

              {/* Upload Students CSV/Excel */}
              <div className="glass-card no-print">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Bulk CSV / Excel Upload</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                  Select a CSV or Excel (.xlsx/.xls) file containing: <strong>Roll Number, Name, DOB</strong> headers. Select the target Year and Section below to assign to all imported records.
                </p>
                <form onSubmit={handleCsvUpload}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Assign Year</label>
                      <select className="form-input" value={csvYear} onChange={(e) => setCsvYear(parseInt(e.target.value))}>
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Assign Section</label>
                      <select
                        className="form-input"
                        value={['A', 'B', 'C', 'D', 'E'].includes(csvSection) ? csvSection : 'Custom'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Custom') {
                            setCsvSection('');
                          } else {
                            setCsvSection(val);
                          }
                        }}
                      >
                        <option value="A">Section A</option>
                        <option value="B">Section B</option>
                        <option value="C">Section C</option>
                        <option value="D">Section D</option>
                        <option value="E">Section E</option>
                        <option value="Custom">Custom...</option>
                      </select>
                      {!['A', 'B', 'C', 'D', 'E'].includes(csvSection) && (
                        <input
                          type="text"
                          className="form-input"
                          style={{ marginTop: '0.5rem', textTransform: 'uppercase' }}
                          placeholder="Type section..."
                          value={csvSection}
                          onChange={(e) => setCsvSection(e.target.value.toUpperCase())}
                          required
                        />
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">CSV / Excel File</label>
                    <input
                      id="csvFileInput"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="form-input"
                      onChange={(e) => setCsvFile(e.target.files[0])}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}>
                    📤 Upload File
                  </button>
                </form>

                {studentMessage.text && (
                  <div className={`badge badge-${studentMessage.type}`} style={{ display: 'block', width: '100%', padding: '0.75rem', marginTop: '1.5rem', textAlign: 'center' }}>
                    {studentMessage.text}
                  </div>
                )}

                {studentMessage.errors && studentMessage.errors.length > 0 && (
                  <div style={{ 
                    marginTop: '1rem', 
                    maxHeight: '150px', 
                    overflowY: 'auto', 
                    background: 'rgba(0, 0, 0, 0.2)', 
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '6px', 
                    padding: '0.75rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    textAlign: 'left'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--danger)' }}>Skipped Rows / Errors:</strong>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: '1.4' }}>
                      {studentMessage.errors.map((err, index) => (
                        <li key={index} style={{ marginBottom: '0.25rem' }}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {previewStudents.length > 0 && (
              <div className="glass-card" style={{ marginTop: '1.5rem', marginBottom: '2rem', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>📋 Upload Preview & Verification</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.25rem', margin: 0 }}>
                      Verify or edit candidate records before syncing with the database.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-success" onClick={handleSaveRoster}>
                      ✅ Save & Synchronize
                    </button>
                    <button className="btn btn-danger" onClick={() => setPreviewStudents([])}>
                      ❌ Clear Preview
                    </button>
                  </div>
                </div>

                <div 
                  className="badge badge-success" 
                  style={{ 
                    display: 'block', 
                    padding: '0.85rem 1rem', 
                    marginBottom: '1.5rem', 
                    fontSize: '0.9rem', 
                    textAlign: 'left', 
                    fontWeight: 600,
                    lineHeight: '1.4' 
                  }}
                >
                  🟢 <strong>{previewStudents.length} students loaded in memory</strong> for target class: <strong>{csvYear}{csvYear === 1 ? 'st' : csvYear === 2 ? 'nd' : csvYear === 3 ? 'rd' : 'th'} Year - Section {csvSection}</strong>.
                  <br />
                  <span style={{ fontSize: '0.8rem', fontWeight: 'normal', opacity: 0.9 }}>
                    You can edit fields inline or remove rows using the delete button. Click <strong>Save & Synchronize</strong> to write to database.
                  </span>
                </div>

                <div style={{ overflowX: 'auto', maxHeight: '450px', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
                  <table className="table" style={{ margin: 0, minWidth: '700px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '60px', textAlign: 'center' }}>#</th>
                        <th>Identifier (Roll/Reg No)</th>
                        <th>Candidate Name</th>
                        <th style={{ width: '220px' }}>Date of Birth</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewStudents.map((stud, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>{idx + 1}</td>
                          <td>
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ margin: 0, padding: '0.4rem 0.75rem', fontSize: '0.9rem', textTransform: 'uppercase' }} 
                              value={stud.roll_number}
                              onChange={(e) => handlePreviewRowChange(idx, 'roll_number', e.target.value.toUpperCase())}
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ margin: 0, padding: '0.4rem 0.75rem', fontSize: '0.9rem' }} 
                              value={stud.name}
                              onChange={(e) => handlePreviewRowChange(idx, 'name', e.target.value)}
                            />
                          </td>
                          <td>
                            <input 
                              type="date" 
                              className="form-input" 
                              style={{ margin: 0, padding: '0.4rem 0.75rem', fontSize: '0.9rem' }} 
                              value={stud.dob}
                              onChange={(e) => handlePreviewRowChange(idx, 'dob', e.target.value)}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              type="button"
                              className="btn btn-danger" 
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto', display: 'inline-flex', alignSelf: 'center' }}
                              onClick={() => handleRemovePreviewRow(idx)}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button className="btn btn-danger" style={{ padding: '0.6rem 1.5rem' }} onClick={() => setPreviewStudents([])}>
                    ❌ Cancel
                  </button>
                  <button className="btn btn-success" style={{ padding: '0.6rem 1.75rem' }} onClick={handleSaveRoster}>
                    💾 Save & Synchronize Roster
                  </button>
                </div>
              </div>
            )}

            {/* Students List with Filter */}
            <div className="glass-card printable-area">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Registered Students</h3>
                <div className="no-print" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    className="form-input"
                    style={{ width: '110px', padding: '0.5rem' }}
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                  >
                    <option value="">All Years</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                  
                  <select
                    className="form-input"
                    style={{ width: '130px', padding: '0.5rem' }}
                    value={['', 'A', 'B', 'C', 'D', 'E'].includes(filterSection) ? filterSection : 'Custom'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'Custom') {
                        setFilterSection('');
                      } else {
                        setFilterSection(val);
                      }
                    }}
                  >
                    <option value="">All Sections</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                    <option value="E">Section E</option>
                    <option value="Custom">Custom...</option>
                  </select>

                  {!['', 'A', 'B', 'C', 'D', 'E'].includes(filterSection) && (
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: '90px', padding: '0.5rem', textTransform: 'uppercase' }}
                      placeholder="Section..."
                      value={filterSection}
                      onChange={(e) => setFilterSection(e.target.value.toUpperCase())}
                    />
                  )}

                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} 
                    onClick={loadStudents}
                  >
                    🔍 Filter
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderColor: 'var(--success)', color: 'var(--success)' }} 
                    onClick={downloadStudentsExcel}
                  >
                    📥 Excel
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} 
                    onClick={() => window.print()}
                  >
                    🖨️ Print
                  </button>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Roll Number</th>
                      <th>Name</th>
                      <th>DOB</th>
                      <th>Year</th>
                      <th>Section</th>
                      <th>Exams Taken</th>
                      <th>Average Score</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                          No students registered.
                        </td>
                      </tr>
                    ) : (
                      students.map(student => (
                        <tr key={student.id}>
                          <td style={{ fontWeight: 700 }}>{student.roll_number}</td>
                          <td style={{ fontWeight: 600 }}>{student.name}</td>
                          <td>{student.dob}</td>
                          <td>Yr {student.year}</td>
                          <td>Sec {student.section}</td>
                          <td>{student.exams_taken}</td>
                          <td style={{ fontWeight: 600 }}>{student.average_score}%</td>
                          <td>
                            <button className="btn btn-danger" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleDeleteStudent(student.id)}>
                              🗑️ Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && !selectedExam && (
          <div>
            <div className="glass-card report-filters-bar no-print">
              <div style={{ flex: 1, display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
                  <label className="form-label">Year</label>
                  <select
                    className="form-input"
                    value={reportsYear}
                    onChange={(e) => setReportsYear(parseInt(e.target.value))}
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0, minWidth: '120px' }}>
                  <label className="form-label">Section</label>
                  <input
                    type="text"
                    className="form-input"
                    value={reportsSection}
                    onChange={(e) => setReportsSection(e.target.value.toUpperCase())}
                    placeholder="e.g. A"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '220px' }}>
                  <label className="form-label">Exam Topic</label>
                  <select
                    className="form-input"
                    value={reportsExamId}
                    onChange={(e) => setReportsExamId(e.target.value)}
                  >
                    <option value="">-- Choose Exam Topic --</option>
                    {exams.map(exam => (
                      <option key={exam.id} value={exam.id}>
                        {exam.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {classReport.length > 0 && (
                <button 
                  className="btn btn-primary" 
                  onClick={() => window.print()}
                  style={{ alignSelf: 'flex-end', height: '46px' }}
                >
                  🖨️ Print Report
                </button>
              )}
            </div>

            {/* Print Header (Only visible when printing) */}
            {reportsExamId && (
              <div className="print-only" style={{ borderBottom: '2px solid #000', paddingBottom: '1rem' }}>
                <h1 style={{ margin: 0 }}>EXAMGUARD PORTAL REPORT</h1>
                <h2 style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '16pt' }}>Class Exam Report: {reportExamTitle}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '10pt', color: '#444' }}>
                  <div><strong>Year:</strong> {reportsYear} | <strong>Section:</strong> {reportsSection}</div>
                  <div style={{ textAlign: 'right' }}><strong>Printed On:</strong> {new Date().toLocaleString()}</div>
                </div>
              </div>
            )}

            {!reportsExamId ? (
              <div className="glass-card flex-center" style={{ padding: '4rem', flexDirection: 'column', color: 'var(--text-secondary)' }}>
                <span>📑</span>
                <p style={{ marginTop: '0.5rem' }}>Please select an Exam Topic, Year, and Section to generate report.</p>
              </div>
            ) : reportsLoading ? (
              <div className="glass-card flex-center" style={{ padding: '4rem' }}>
                <span className="text-gradient" style={{ fontWeight: 600 }}>Loading class report...</span>
              </div>
            ) : reportsMessage ? (
              <div className="glass-card flex-center" style={{ padding: '4rem', color: 'var(--danger)' }}>
                <p>{reportsMessage}</p>
              </div>
            ) : classReport.length === 0 ? (
              <div className="glass-card flex-center" style={{ padding: '4rem', flexDirection: 'column', color: 'var(--text-secondary)' }}>
                <span>👥</span>
                <p style={{ marginTop: '0.5rem' }}>No students found in Year {reportsYear} Section {reportsSection}.</p>
              </div>
            ) : (
              <div className="glass-card">
                {/* Screen Header Info */}
                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                      Report: <span className="text-gradient">{reportExamTitle}</span>
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.25rem' }}>
                      Year {reportsYear} - Section {reportsSection} | {classReport.length} Students Total
                    </p>
                  </div>
                </div>

                {/* Summary boxes */}
                <div className="report-summary-cards">
                  <div className="report-summary-card">
                    <h4>Total Strength</h4>
                    <p>{classReport.length}</p>
                  </div>
                  <div className="report-summary-card">
                    <h4>Attended</h4>
                    <p style={{ color: 'var(--success)' }}>
                      {classReport.filter(s => s.attended).length}
                    </p>
                  </div>
                  <div className="report-summary-card">
                    <h4>Absent</h4>
                    <p style={{ color: 'var(--danger)' }}>
                      {classReport.filter(s => !s.attended).length}
                    </p>
                  </div>
                  <div className="report-summary-card">
                    <h4>Auto Submitted</h4>
                    <p style={{ color: 'var(--warning)' }}>
                      {classReport.filter(s => s.attended && s.auto_submitted).length}
                    </p>
                  </div>
                </div>

                {/* Main Report Table */}
                <div className="table-wrapper">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Class Rank</th>
                        <th>Roll Number</th>
                        <th>Student Name</th>
                        <th>Attendance</th>
                        <th>MCQ Score</th>
                        <th>Coding Score</th>
                        <th>Total Marks</th>
                        <th>Proctoring (Tab Switches)</th>
                        <th>Submit Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classReport.map(student => (
                        <tr key={student.student_id}>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {!student.attended || !student.rank ? (
                              <span style={{ color: 'var(--text-secondary)' }}>—</span>
                            ) : student.rank === 1 ? (
                              <span style={{ color: '#ffd700' }}>🏆 #1</span>
                            ) : student.rank === 2 ? (
                              <span style={{ color: '#c0c0c0' }}>🥈 #2</span>
                            ) : student.rank === 3 ? (
                              <span style={{ color: '#cd7f32' }}>🥉 #3</span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>#{student.rank}</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 700 }}>{student.roll_number}</td>
                          <td style={{ fontWeight: 600 }}>{student.name}</td>
                          <td>
                            {student.attended ? (
                              <span className="badge badge-attendance-yes">Attended</span>
                            ) : (
                              <span className="badge badge-attendance-no">Absent</span>
                            )}
                          </td>
                          <td>
                            {student.attended && student.score_details ? (
                              `${student.score_details.mcq_score} / ${student.score_details.mcq_total}`
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>—</span>
                            )}
                          </td>
                          <td>
                            {student.attended && student.score_details ? (
                              student.score_details.program_total > 0 ? (
                                `${student.score_details.program_score} / ${student.score_details.program_total}`
                              ) : (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>N/A</span>
                              )
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>—</span>
                            )}
                          </td>
                          <td style={{ fontWeight: student.attended ? 700 : 'normal' }}>
                            {student.attended && student.score_details ? (
                              `${student.score_details.total_score} / ${student.score_details.total_possible}`
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>—</span>
                            )}
                          </td>
                          <td 
                            style={{ 
                              color: student.attended && student.tab_switches > 0 ? 'var(--danger)' : 'inherit', 
                              fontWeight: student.attended && student.tab_switches > 0 ? 700 : 'normal' 
                            }}
                          >
                            {student.attended ? `${student.tab_switches} switches` : '—'}
                          </td>
                          <td>
                            {student.attended ? (
                              student.auto_submitted ? (
                                <span className="badge badge-danger">⚠️ Auto Submit</span>
                              ) : (
                                <span className="badge badge-success">✅ Manual</span>
                              )
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>—</span>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            {student.attended && student.submitted_at ? (
                              new Date(student.submitted_at).toLocaleString()
                            ) : (
                              <span>—</span>
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

        {/* EXAMS LISTING TAB */}

        {activeTab === 'exams' && !selectedExam && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {/* Create Exam Card */}
            <div className="glass-card" style={{ height: 'fit-content' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>{editingExamId ? 'Edit Exam' : 'Create Exam'}</h3>
              <form onSubmit={handleCreateExam}>
                <div className="form-group">
                  <label className="form-label">Exam Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={examForm.title}
                    onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                    placeholder="e.g. Midterm Programming Exam"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={examForm.description}
                    onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
                    placeholder="Describe guidelines for this examination..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Duration (minutes)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={examForm.duration_minutes}
                      onChange={(e) => setExamForm({ ...examForm, duration_minutes: parseInt(e.target.value) || 30 })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Exam Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={examForm.exam_date}
                      onChange={(e) => setExamForm({ ...examForm, exam_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Target Year(s)</label>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    {[1, 2, 3, 4].map(yr => {
                      const isChecked = examForm.target_years.includes(yr);
                      return (
                        <label key={yr} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...examForm.target_years, yr]
                                : examForm.target_years.filter(y => y !== yr);
                              setExamForm({ ...examForm, target_years: updated });
                            }}
                          />
                          {yr}{yr === 1 ? 'st' : yr === 2 ? 'nd' : yr === 3 ? 'rd' : 'th'}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Target Section(s)</label>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    {['A', 'B', 'C', 'D', 'E'].map(sec => {
                      const isChecked = examForm.target_sections.includes(sec);
                      return (
                        <label key={sec} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...examForm.target_sections, sec]
                                : examForm.target_sections.filter(s => s !== sec);
                              setExamForm({ ...examForm, target_sections: updated });
                            }}
                          />
                          {sec}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}>
                  {editingExamId ? '💾 Save Changes' : '📝 Create Exam'}
                </button>
                {editingExamId && (
                  <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }} onClick={cancelEditExam}>
                    ❌ Cancel Edit
                  </button>
                )}
              </form>

              {examMessage.text && (
                <div className={`badge badge-${examMessage.type}`} style={{ display: 'block', width: '100%', padding: '0.75rem', marginTop: '1.5rem', textAlign: 'center' }}>
                  {examMessage.text}
                </div>
              )}
            </div>

            {/* List of Exams */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Existing Examinations</h3>
              {exams.length === 0 ? (
                <div className="glass-card flex-center" style={{ padding: '3rem', flexDirection: 'column', color: 'var(--text-secondary)' }}>
                  <span>📋</span>
                  <p style={{ marginTop: '0.5rem' }}>No exams created yet.</p>
                </div>
              ) : (
                exams.map(exam => (
                  <div key={exam.id} className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{exam.title}</h4>
                      <span className={`badge ${exam.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {exam.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                      {exam.description || 'No description available.'}
                    </p>
                    <div className="card-meta" style={{ marginBottom: '0.75rem' }}>
                      <span>⏱️ {exam.duration_minutes} min</span>
                      <span>📅 {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : 'Today'}</span>
                      <span>❓ {exam.question_count} questions</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div>🎯 <strong>Years:</strong> {exam.target_years ? exam.target_years.map(y => y === 1 ? '1st' : y === 2 ? '2nd' : y === 3 ? '3rd' : '4th').join(', ') : 'All'}</div>
                      <div>🎯 <strong>Sections:</strong> {exam.target_sections ? exam.target_sections.join(', ') : 'All'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }} onClick={() => loadExamDetails(exam)}>
                        ⚙️ Manage Questions
                      </button>
                      <button className={`btn ${exam.is_active ? 'btn-secondary' : 'btn-success'}`} style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }} onClick={() => handleToggleExam(exam.id)}>
                        {exam.is_active ? '⏸️ Deactivate' : '▶️ Activate'}
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }} onClick={() => startEditExam(exam)}>
                        ✏️ Edit Exam
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', borderColor: 'var(--warning)', color: 'var(--warning)' }} onClick={() => handleResetExam(exam.id)}>
                        🔄 Re-exam / Reset
                      </button>
                      <button className="btn btn-danger" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }} onClick={() => handleDeleteExam(exam.id)}>
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* QUESTIONS DETAIL & CREATION VIEWER */}
        {selectedExam && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => setSelectedExam(null)}>
                ← Back to Exams
              </button>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{selectedExam.title} Details</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* Question Creation Form */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Add Question</h3>
                <form onSubmit={handleAddQuestion}>
                  <div className="form-group">
                    <label className="form-label">Question Type</label>
                    <select
                      className="form-input"
                      value={questionForm.question_type}
                      onChange={(e) => setQuestionForm({ ...questionForm, question_type: e.target.value })}
                    >
                      <option value="MCQ">Multiple Choice Question (MCQ)</option>
                      <option value="PROGRAM">Programming Question</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Question Text</label>
                    <textarea
                      className="form-input"
                      rows="3"
                      value={questionForm.question_text}
                      onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                      placeholder="Type the question content here..."
                      required
                    />
                  </div>

                  {questionForm.question_type === 'MCQ' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label className="form-label">Option A</label>
                          <input type="text" className="form-input" value={questionForm.option_a} onChange={(e) => setQuestionForm({ ...questionForm, option_a: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Option B</label>
                          <input type="text" className="form-input" value={questionForm.option_b} onChange={(e) => setQuestionForm({ ...questionForm, option_b: e.target.value })} required />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label className="form-label">Option C</label>
                          <input type="text" className="form-input" value={questionForm.option_c} onChange={(e) => setQuestionForm({ ...questionForm, option_c: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Option D</label>
                          <input type="text" className="form-input" value={questionForm.option_d} onChange={(e) => setQuestionForm({ ...questionForm, option_d: e.target.value })} required />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Correct Option</label>
                        <select className="form-input" value={questionForm.correct_option} onChange={(e) => setQuestionForm({ ...questionForm, correct_option: e.target.value })}>
                          <option value="A">Option A</option>
                          <option value="B">Option B</option>
                          <option value="C">Option C</option>
                          <option value="D">Option D</option>
                        </select>
                      </div>
                    </>
                  )}

                  {questionForm.question_type === 'PROGRAM' && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span>Test Cases</span>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', gap: '0.25rem' }}
                          onClick={() => setTestCases([...testCases, { input: '', expected_output: '', is_public: true }])}
                        >
                          ➕ Add Test Case
                        </button>
                      </label>
                      {testCases.map((tc, index) => (
                        <div key={index} className="glass-card" style={{ padding: '0.75rem', marginTop: '0.75rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Test Case #{index + 1}</span>
                            {testCases.length > 1 && (
                              <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem' }}
                                onClick={() => setTestCases(testCases.filter((_, idx) => idx !== index))}
                              >
                                🗑️ Remove
                              </button>
                            )}
                          </div>
                          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Input (stdin)</label>
                            <textarea
                              rows="2"
                              className="form-input"
                              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                              value={tc.input}
                              onChange={(e) => {
                                const newTcs = [...testCases];
                                newTcs[index].input = e.target.value;
                                setTestCases(newTcs);
                              }}
                              placeholder="e.g. 5\n10"
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Expected Output</label>
                            <textarea
                              rows="2"
                              className="form-input"
                              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                              value={tc.expected_output}
                              onChange={(e) => {
                                const newTcs = [...testCases];
                                newTcs[index].expected_output = e.target.value;
                                setTestCases(newTcs);
                              }}
                              placeholder="e.g. 15"
                              required
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <input
                              type="checkbox"
                              id={`is-public-${index}`}
                              checked={tc.is_public}
                              onChange={(e) => {
                                const newTcs = [...testCases];
                                newTcs[index].is_public = e.target.checked;
                                setTestCases(newTcs);
                              }}
                            />
                            <label htmlFor={`is-public-${index}`} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                              Public (visible to students during exam)
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Marks</label>
                    <input
                      type="number"
                      className="form-input"
                      value={questionForm.marks}
                      onChange={(e) => setQuestionForm({ ...questionForm, marks: parseInt(e.target.value) || 1 })}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}>
                    ➕ Add Question
                  </button>
                </form>
              </div>

              {/* Upload Questions File */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Import Questions from Document</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                  Upload a PDF, Word (.docx) or Text (.txt) file containing MCQs. The system will automatically parse and import them directly.
                </p>
                <form onSubmit={handleUploadQuestionsFile}>
                  <div className="form-group">
                    <label className="form-label">Document File</label>
                    <input
                      id="questionsFileInput"
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="form-input"
                      onChange={(e) => setFileToUpload(e.target.files[0])}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}>
                    📤 Parse & Import Questions
                  </button>
                </form>

                {examMessage.text && (
                  <div className={`badge badge-${examMessage.type}`} style={{ display: 'block', width: '100%', padding: '0.75rem', marginTop: '1.5rem', textAlign: 'center' }}>
                    {examMessage.text}
                  </div>
                )}
              </div>
            </div>

            {/* List of Current Questions */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Exam Questions ({questions.length})</h3>
              {questions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
                  No questions added to this exam yet. Use the builders above.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {questions.map((q, idx) => (
                    <div key={q.id} style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          Q{idx + 1}. <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>({q.question_type})</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span className="badge badge-warning">{q.marks} Marks</span>
                          <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px' }} onClick={() => handleDeleteQuestion(q.id)}>
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '1rem', whiteSpace: 'pre-line' }}>
                        {q.question_text}
                      </div>
                      {q.question_type === 'MCQ' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', paddingLeft: '1rem' }}>
                          <div style={{ color: q.correct_option === 'A' ? 'var(--success)' : 'inherit', fontWeight: q.correct_option === 'A' ? 700 : 'normal' }}>
                            <strong>A:</strong> {q.option_a} {q.correct_option === 'A' && '✓'}
                          </div>
                          <div style={{ color: q.correct_option === 'B' ? 'var(--success)' : 'inherit', fontWeight: q.correct_option === 'B' ? 700 : 'normal' }}>
                            <strong>B:</strong> {q.option_b} {q.correct_option === 'B' && '✓'}
                          </div>
                          <div style={{ color: q.correct_option === 'C' ? 'var(--success)' : 'inherit', fontWeight: q.correct_option === 'C' ? 700 : 'normal' }}>
                            <strong>C:</strong> {q.option_c} {q.correct_option === 'C' && '✓'}
                          </div>
                          <div style={{ color: q.correct_option === 'D' ? 'var(--success)' : 'inherit', fontWeight: q.correct_option === 'D' ? 700 : 'normal' }}>
                            <strong>D:</strong> {q.option_d} {q.correct_option === 'D' && '✓'}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* STUDENT SUBMISSION ANSWERS MODAL */}
      {viewingAnswersModal && activeResultAnswers && (
        <div className="modal-overlay" onClick={() => setViewingAnswersModal(false)}>
          <div className="glass-card modal-box" style={{ maxWidth: '800px', width: '90%', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 className="modal-title" style={{ margin: 0 }}>Code Answers Submissions</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {activeResultAnswers.student.name} ({activeResultAnswers.student.roll_number})
                </p>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem' }} onClick={() => setViewingAnswersModal(false)}>
                ✕ Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {activeResultAnswers.answers.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No code submissions recorded for this exam.</p>
              ) : (
                activeResultAnswers.answers.map((answer, index) => (
                  <div key={answer.id} style={{ borderBottom: index < activeResultAnswers.answers.length - 1 ? '1px solid var(--border-glass)' : 'none', paddingBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Question {index + 1} ({answer.question_type})</span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {answer.question_type === 'PROGRAM' && answer.language && (
                          <span className="badge badge-success" style={{ background: 'rgba(0, 230, 118, 0.1)', color: '#00e676', border: '1px solid rgba(0, 230, 118, 0.2)', textTransform: 'uppercase', fontSize: '0.78rem' }}>
                            💻 {answer.language}
                          </span>
                        )}
                        <span className="badge badge-warning">{answer.marks} Marks</span>
                      </div>
                    </div>
                    <p style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem', marginBottom: '0.75rem', whiteSpace: 'pre-line' }}>{answer.question_text}</p>
                    <pre style={{ background: '#050510', border: '1px solid var(--border-glass)', padding: '1rem', borderRadius: '8px', overflowX: 'auto', fontSize: '0.9rem', color: '#00e676', fontFamily: 'Courier New, monospace', whiteSpace: 'pre-wrap' }}>
                      {answer.answer_text}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="glass-card modal-box" style={{ maxWidth: '450px', width: '90%', padding: '2rem', textAlign: 'center', animation: 'scaleIn 0.3s ease-out' }} onClick={(e) => e.stopPropagation()}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>⚠️</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '0.75rem' }}>{confirmModal.title}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.5', marginBottom: '1.75rem' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" style={{ padding: '0.55rem 1.5rem' }} onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
                Cancel
              </button>
              <button className="btn btn-danger" style={{ padding: '0.55rem 1.5rem' }} onClick={confirmModal.onConfirm}>
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
