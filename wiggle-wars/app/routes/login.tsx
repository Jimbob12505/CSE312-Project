import "../styles/login.css"
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    const payload = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    try {
      const response = await fetch('/login', {
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
<div className="login-background">
  <form onSubmit={handleSubmit}>
    <h1>Login</h1>

    <div className="box">
      <label htmlFor="username">Username</label>
      <input type="text" id="username" required />
    </div>

    <div className="box">
      <label htmlFor="pwd">Password</label>
      <input type="password" id="pwd" required />
      <a href="./register.html">Register account</a>
    </div>

    <div className="box">
      <input type="submit" value="Sign in" />
    </div>
  </form>
</div>
  );
}