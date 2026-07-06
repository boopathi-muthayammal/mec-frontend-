import React, { useState, useEffect } from 'react';
import AdminLogin from './pages/AdminLogin';
import StudentLogin from './pages/StudentLogin';
import AdminDashboard from './pages/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import StudentExam from './pages/StudentExam';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [searchParams, setSearchParams] = useState(new URLSearchParams(window.location.search));

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
      setSearchParams(new URLSearchParams(window.location.search));
    };

    window.addEventListener('popstate', handleLocationChange);
    
    // Add custom listener for programatic routing
    window.addEventListener('pushstate', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('pushstate', handleLocationChange);
    };
  }, []);

  // Programmatic navigation helper
  window.navigateTo = (path, search = '') => {
    const url = path + (search ? '?' + search : '');
    window.history.pushState({}, '', url);
    const event = new Event('pushstate');
    window.dispatchEvent(event);
  };

  // Simple Router Switcher
  const renderPage = () => {
    // If root path, redirect to student login
    if (currentPath === '/' || currentPath === '/index.html') {
      return <StudentLogin />;
    }

    if (currentPath === '/admin' || currentPath === '/admin/login' || currentPath === '/admin/login.html') {
      return <AdminLogin />;
    }

    if (currentPath === '/admin/dashboard' || currentPath === '/admin/dashboard.html') {
      return <AdminDashboard />;
    }

    if (currentPath === '/student' || currentPath === '/student/login' || currentPath === '/student/login.html') {
      return <StudentLogin />;
    }

    if (currentPath === '/student/dashboard' || currentPath === '/student/dashboard.html') {
      return <StudentDashboard />;
    }

    if (currentPath === '/student/exam' || currentPath === '/student/exam.html') {
      const examId = searchParams.get('id');
      return <StudentExam examId={examId} />;
    }

    // Default 404
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <h1 style={{ fontSize: '3rem' }}>404</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Page Not Found</p>
        <button className="btn btn-primary" onClick={() => window.navigateTo('/')}>
          Go to Student Login
        </button>
      </div>
    );
  };

  return (
    <>
      {renderPage()}
    </>
  );
}

export default App;
