import React from 'react';

/**
 * Full-screen animated processing overlay shown while login is in progress.
 * Props:
 *   visible  – boolean, whether to show the overlay
 *   role     – 'student' | 'admin'  (controls the colour accent and label)
 */
function LoginLoader({ visible, role = 'student' }) {
  if (!visible) return null;

  const isAdmin = role === 'admin';

  const styles = {
    overlay: {
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2.5rem',
      background: 'rgba(10, 10, 22, 0.92)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      animation: 'llFadeIn 0.3s ease-out',
    },
    card: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1.75rem',
      padding: '3rem 3.5rem',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: '24px',
      boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      minWidth: '320px',
    },
    orbitRing: {
      position: 'relative',
      width: '90px',
      height: '90px',
    },
    icon: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '2.6rem',
    },
    title: {
      fontSize: '1.45rem',
      fontWeight: 800,
      color: '#ffffff',
      letterSpacing: '-0.02em',
      textAlign: 'center',
      lineHeight: 1.3,
    },
    subtitle: {
      fontSize: '0.88rem',
      color: 'rgba(255,255,255,0.45)',
      textAlign: 'center',
      marginTop: '-1rem',
    },
    dotsRow: {
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center',
    },
  };

  return (
    <>
      <style>{`
        @keyframes llFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes llSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes llPulse {
          0%, 100% { transform: scale(0.65); opacity: 0.35; }
          50%       { transform: scale(1.2);  opacity: 1; }
        }
        @keyframes llSlide {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .ll-ring-outer {
          position: absolute; inset: 0;
          border-radius: 50%;
          border: 3px solid transparent;
          border-top-color: ${isAdmin ? '#f472b6' : '#6c63ff'};
          border-right-color: ${isAdmin ? '#fb923c' : '#a78bfa'};
          animation: llSpin 1.1s linear infinite;
        }
        .ll-ring-inner {
          position: absolute; inset: 10px;
          border-radius: 50%;
          border: 2px solid transparent;
          border-bottom-color: ${isAdmin ? '#facc15' : '#34d399'};
          border-left-color: ${isAdmin ? '#34d399' : '#60a5fa'};
          animation: llSpin 0.75s linear infinite reverse;
        }
        .ll-dot {
          width: 9px; height: 9px; border-radius: 50%;
          background: ${isAdmin ? '#f472b6' : '#6c63ff'};
          animation: llPulse 1.2s ease-in-out infinite;
        }
        .ll-dot:nth-child(2) { animation-delay: 0.2s; background: ${isAdmin ? '#fb923c' : '#a78bfa'}; }
        .ll-dot:nth-child(3) { animation-delay: 0.4s; background: ${isAdmin ? '#facc15' : '#34d399'}; }
        .ll-bar-wrap {
          width: 220px; height: 5px;
          background: rgba(255,255,255,0.07);
          border-radius: 99px;
          overflow: hidden;
        }
        .ll-bar {
          height: 100%; width: 50%; border-radius: 99px;
          background: linear-gradient(90deg,
            transparent,
            ${isAdmin ? '#f472b6' : '#6c63ff'},
            ${isAdmin ? '#fb923c' : '#a78bfa'},
            transparent
          );
          background-size: 200% 100%;
          animation: llSlide 1.4s linear infinite;
        }
      `}</style>

      <div style={styles.overlay}>
        <div style={styles.card}>
          {/* Spinning orbit rings + icon */}
          <div style={styles.orbitRing}>
            <div className="ll-ring-outer" />
            <div className="ll-ring-inner" />
            <div style={styles.icon}>{isAdmin ? '🛡️' : '🎓'}</div>
          </div>

          <div style={styles.title}>
            {isAdmin ? 'Authenticating Admin...' : 'Verifying Identity...'}
          </div>
          <p style={styles.subtitle}>
            {isAdmin
              ? 'Checking admin credentials and loading your dashboard'
              : 'Validating roll number and date of birth'}
          </p>

          {/* Bouncing dots */}
          <div style={styles.dotsRow}>
            <div className="ll-dot" />
            <div className="ll-dot" />
            <div className="ll-dot" />
          </div>

          {/* Sliding progress bar */}
          <div className="ll-bar-wrap">
            <div className="ll-bar" />
          </div>
        </div>
      </div>
    </>
  );
}

export default LoginLoader;
