import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/home.css';

export default function Home() {
  return (
      <div className="home-container">
        <div className="home-content">
          <h1 className="home-title">wigglewars.me</h1>

          <p className="home-description">
            Real-time multiplayer snake game!
          </p>

          <Link to="/login" className="play-button">
            Play Now
          </Link>
        </div>
      </div>
  );
}

