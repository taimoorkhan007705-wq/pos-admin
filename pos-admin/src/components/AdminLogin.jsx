import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdmin } from '../services/auth';
import { MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md';

function AdminLogin() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const result = loginAdmin(password);
      
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError('Invalid password');
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔐</div>
          <h2>Admin Login</h2>
          <p style={{ color: 'var(--md-on-surface-variant)', marginTop: '0.5rem' }}>
            Enter password to access admin panel
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <div style={{ 
              position: 'absolute', 
              left: '1rem', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'var(--md-on-surface-variant)'
            }}>
              <MdLock size={20} />
            </div>
            
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ 
                paddingLeft: '3rem',
                paddingRight: '3rem'
              }}
              required
              autoFocus
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--md-on-surface-variant)',
                padding: 0,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {showPassword ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
            </button>
          </div>

          {error && (
            <div style={{
              padding: '0.75rem',
              background: 'var(--md-error-container)',
              color: 'var(--md-error)',
              borderRadius: 'var(--md-sys-shape-corner-small)',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              fontWeight: 600
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{ 
          marginTop: '1.5rem', 
          textAlign: 'center',
          fontSize: '0.875rem',
          color: 'var(--md-on-surface-variant)'
        }}>
          <p>Default password: <strong>admin123</strong></p>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;