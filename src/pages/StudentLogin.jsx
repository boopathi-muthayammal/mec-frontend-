import React, { useState, useEffect } from 'react';
import LoginLoader from '../components/LoginLoader';

function StudentLogin() {
  const [rollNumber, setRollNumber] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/check-session')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.role === 'student') {
          window.navigateTo('/student/dashboard');
        }
      })
      .catch(() => { });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rollNumber || !dob) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll_number: rollNumber, dob })
      });
      const data = await res.json();
      if (data.success) {
        window.navigateTo('/student/dashboard');
      } else {
        setError(data.message || 'Invalid Roll Number or DOB');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <LoginLoader visible={loading} role="student" />
      <div className="login-container">
        <div className="login-card glass-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '3rem' }}>🛡️</span>
          <h2 className="text-gradient" style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem' }}>
            MEC-CSE-EXAM PORTAL
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Enter details to start your examination
          </p>
        </div>

        {error && (
          <div className="badge badge-danger" style={{ display: 'block', width: '100%', padding: '0.75rem', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Roll Number</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 21CS072"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              style={{ textTransform: 'uppercase' }}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Date of Birth (DOB)</label>
            <input
              type="date"
              className="form-input"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <a href="/admin/login" onClick={(e) => { e.preventDefault(); window.navigateTo('/admin/login'); }} style={{ color: 'var(--accent)', fontSize: '0.88rem', textDecoration: 'none', fontWeight: 600 }}>
            Admin Portal →
          </a>
        </div>
        </div>
      </div>
    </>
  );
}

export default StudentLogin;
