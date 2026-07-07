import React, { useState } from 'react';
import LoginLoader from '../components/LoginLoader';

function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        window.navigateTo('/admin/dashboard');
      } else {
        setError(data.message || 'Invalid username or password');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <LoginLoader visible={loading} role="admin" />
      <div className="login-container">
        <div className="login-card glass-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '3rem' }}>🛡️</span>
          <h2 className="text-gradient" style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem' }}>
            MEC-CSE-EXAM PORTAL Admin
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Sign in to manage exams and students
          </p>
        </div>

        {error && (
          <div className="badge badge-danger" style={{ display: 'block', width: '100%', padding: '0.75rem', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username / Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="admin@example.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <a href="/student/login" onClick={(e) => { e.preventDefault(); window.navigateTo('/student/login'); }} style={{ color: 'var(--accent)', fontSize: '0.88rem', textDecoration: 'none', fontWeight: 600 }}>
            Student Login →
          </a>
        </div>
        </div>
      </div>
    </>
  );
}

export default AdminLogin;
