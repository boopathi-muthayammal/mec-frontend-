import React, { useState, useEffect } from 'react';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview'); // overview, students, exams
  const [adminUser, setAdminUser] = useState(null);
  
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
  const [studentMessage, setStudentMessage] = useState({ type: '', text: '' });

  // Exams Tab State
  const [exams, setExams] = useState([]);
  const [examForm, setExamForm] = useState({
    title: '',
    description: '',
    duration_minutes: 30,
    target_years: [1, 2, 3, 4],
    target_sections: ['A', 'B', 'C', 'D', 'E']
  });
  const [selectedExam, setSelectedExam] = useState(null); // When viewing questions for an exam

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
    }
  }, [activeTab, filterYear, filterSection]);

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
    setStudentMessage({ type: '', text: '' });

    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('year', csvYear);
    formData.append('section', csvSection);

    try {
      const res = await fetch('/api/admin/students/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setStudentMessage({ type: 'success', text: data.message });
        setCsvFile(null);
        // Reset file input element
        document.getElementById('csvFileInput').value = '';
        loadStudents();
      } else {
        setStudentMessage({ type: 'danger', text: data.message || 'CSV Upload failed.' });
      }
    } catch (err) {
      setStudentMessage({ type: 'danger', text: 'Error uploading CSV.' });
    }
  };

  const handleDeleteStudent = async (id) => {
    if (!confirm('Are you sure you want to delete this student? All their results and answers will be deleted.')) return;
    try {
      const res = await fetch(`/api/admin/students/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadStudents();
      }
    } catch (err) {
      console.error('Error deleting student:', err);
    }
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

  const handleCreateExam = async (e) => {
    e.preventDefault();
    setExamMessage({ type: '', text: '' });
    try {
      const res = await fetch('/api/admin/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(examForm)
      });
      const data = await res.json();
      if (data.success) {
        setExamMessage({ type: 'success', text: 'Exam created successfully!' });
        setExamForm({
          title: '',
          description: '',
          duration_minutes: 30,
          target_years: [1, 2, 3, 4],
          target_sections: ['A', 'B', 'C', 'D', 'E']
        });
        loadExams();
      } else {
        setExamMessage({ type: 'danger', text: data.message || 'Failed to create exam.' });
      }
    } catch (err) {
      setExamMessage({ type: 'danger', text: 'Error creating exam.' });
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

  const handleDeleteExam = async (id) => {
    if (!confirm('Are you sure you want to delete this exam? All questions, answers and results will be permanently removed.')) return;
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
        setExtractedText(data.extracted_text);
        setFileToUpload(null);
        document.getElementById('questionsFileInput').value = '';
        setExamMessage({ type: 'success', text: 'Questions text extracted successfully! Please review below and enter them manually.' });
      } else {
        setExamMessage({ type: 'danger', text: data.message || 'Extraction failed.' });
      }
    } catch (err) {
      setExamMessage({ type: 'danger', text: 'Error extracting questions.' });
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadExamDetails(selectedExam);
      }
    } catch (err) {
      console.error('Error deleting question:', err);
    }
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
        <div className="tabs-nav">
          <button className={`tab-btn ${activeTab === 'overview' && !selectedExam ? 'active' : ''}`} onClick={() => { setActiveTab('overview'); setSelectedExam(null); }}>
            📊 Overview
          </button>
          <button className={`tab-btn ${activeTab === 'students' && !selectedExam ? 'active' : ''}`} onClick={() => { setActiveTab('students'); setSelectedExam(null); }}>
            🎓 Students
          </button>
          <button className={`tab-btn ${activeTab === 'exams' || selectedExam ? 'active' : ''}`} onClick={() => { setActiveTab('exams'); }}>
            📝 Exams {selectedExam && `> ${selectedExam.title}`}
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
                      <th>Tabs Switched</th>
                      <th>Status</th>
                      <th>Submitted At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentResults.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
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
              <div className="glass-card">
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
                      <input
                        type="text"
                        className="form-input"
                        value={studentForm.section}
                        onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                        placeholder="e.g. A"
                        style={{ textTransform: 'uppercase' }}
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}>
                    ➕ Add Student
                  </button>
                </form>
              </div>

              {/* Upload Students CSV */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Bulk CSV Upload</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                  Select a CSV file containing: <strong>Roll Number, Name, DOB</strong> headers. Select the target Year and Section below to assign to all imported records.
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
                      <input
                        type="text"
                        className="form-input"
                        value={csvSection}
                        onChange={(e) => setCsvSection(e.target.value)}
                        placeholder="e.g. A"
                        style={{ textTransform: 'uppercase' }}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">CSV File</label>
                    <input
                      id="csvFileInput"
                      type="file"
                      accept=".csv"
                      className="form-input"
                      onChange={(e) => setCsvFile(e.target.files[0])}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}>
                    📤 Upload CSV
                  </button>
                </form>

                {studentMessage.text && (
                  <div className={`badge badge-${studentMessage.type}`} style={{ display: 'block', width: '100%', padding: '0.75rem', marginTop: '1.5rem', textAlign: 'center' }}>
                    {studentMessage.text}
                  </div>
                )}
              </div>
            </div>

            {/* Students List with Filter */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Registered Students</h3>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <select className="form-input" style={{ width: '130px', padding: '0.5rem' }} value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                    <option value="">All Years</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '110px', padding: '0.5rem', textTransform: 'uppercase' }}
                    placeholder="Section"
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                  />
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

        {/* EXAMS LISTING TAB */}
        {activeTab === 'exams' && !selectedExam && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {/* Create Exam Card */}
            <div className="glass-card" style={{ height: 'fit-content' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Create Exam</h3>
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
                  📝 Create Exam
                </button>
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
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Extract Questions from Document</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                  Upload a PDF, Word (.docx) or Text (.txt) file containing examination questions to automatically extract and copy question texts.
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
                    📄 Extract Text
                  </button>
                </form>

                {extractedText && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <label className="form-label">Extracted Text Preview:</label>
                    <textarea
                      className="form-input"
                      rows="8"
                      value={extractedText}
                      readOnly
                      style={{ fontSize: '0.82rem', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', marginTop: '0.25rem' }}
                    />
                  </div>
                )}

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
                      <span className="badge badge-warning">{answer.marks} Marks</span>
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
    </div>
  );
}

export default AdminDashboard;
