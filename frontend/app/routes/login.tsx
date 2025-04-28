import "../styles/login.css";
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = `username=${encodeURIComponent(
      username
    )}&password=${encodeURIComponent(password)}`;

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        credentials: "include",
        body: payload,
      });

      if (response.ok) {
        console.log("Login successful");
        navigate("/game");
      } else {
        const errorText = await response.text();
        if (errorText === "Username does not exist") {
          setError("Invalid username or password");
        } else if (errorText === "Password does not match") {
          setError("Invalid username or password");
        } else {
          setError(errorText || "Login failed");
        }
        console.error("Login failed:", errorText);
      }
    } catch (error) {
      console.error("Network error:", error);
      setError("Network error. Please try again.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-content">
        <h1 className="login-title">wigglewars.me</h1>

        <div className="form-container">
          <div className="form-content">
            <div className="tab-container">
              <Link to="/login" className="tab-button active">
                Login
              </Link>
              <Link to="/register" className="tab-button inactive">
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
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
