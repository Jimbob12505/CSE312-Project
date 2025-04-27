// src/routes/register.tsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/register.css';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // ← client‐side validation:
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, confirmPassword })
      });

      if (res.ok) {
        navigate('/game');
      } else {
        const data = await res.json();
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      console.error(err);
      setError('Network error');
    }
  };

  return (
      <div className="login-container">
        <div className="login-content">
          <h1 className="login-title">wigglewars.me</h1>
          <div className="form-container">
            <div className="form-content">
              <div className="tab-container">
                <Link to="/login" className="tab-button inactive">
                  Login
                </Link>
                <Link to="/register" className="tab-button active">
                  Register
                </Link>
              </div>

              {error && <div className="error-message">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="form-field">
                  <label htmlFor="username" className="form-field-label">
                    Username
                  </label>
                  <input
                      id="username"
                      type="text"
                      className="form-input"
                      placeholder="Enter your username"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="password" className="form-field-label">
                    Password
                  </label>
                  <input
                      id="password"
                      type="password"
                      className="form-input"
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="confirmPassword" className="form-field-label">
                    Confirm Password
                  </label>
                  <input
                      id="confirmPassword"
                      type="password"
                      className="form-input"
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                  />
                </div>

                <button type="submit" className="form-submit">
                  Register
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
  );
}
