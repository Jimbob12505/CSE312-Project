import "../styles/login.css"
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload,
      });
      if (!response.ok) throw new Error('Login failed');
      console.log('Login successful');
    } catch (error) {
      console.error(error);
    }
  };

  return (
      <div className="login-container">
        <div className="login-content">
          <h1 className="login-title">wigglewars.me</h1>

          <div className="form-container">
            <div className="form-content">
              <div className="tab-container">
                <button
                    className={`tab-button ${isLogin ? 'active' : 'inactive'}`}
                    onClick={() => setIsLogin(true)}
                >
                  Login
                </button>
                <button
                    className={`tab-button ${!isLogin ? 'active' : 'inactive'}`}
                    onClick={() => {
                      setIsLogin(false);
                      navigate('/register');
                    }}
                >
                  Register
                </button>
              </div>

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
                      onChange={(e) => setUsername(e.target.value)}
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
                      onChange={(e) => setPassword(e.target.value)}
                      required
                  />
                </div>

                <button type="submit" className="form-submit">
                  {isLogin ? 'Login' : 'Register'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
  );
}