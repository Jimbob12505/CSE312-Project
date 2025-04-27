import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../game.css';

export default function Game() {
  const [playerName, setPlayerName] = useState('Playername');
  // leaderboard sample data
  // waiting actual API call
  const [leaderboard, setLeaderboard] = useState([
    { id: 1, name: 'Bob', score: 120 },
    { id: 2, name: 'Alice', score: 115 },
    { id: 3, name: 'Jimmy', score: 100 },
    { id: 4, name: 'Sarah', score: 95 },
    { id: 5, name: 'Player 2', score: 80 },
    { id: 6, name: 'Player 1', score: 75 },
    { id: 7, name: 'Player 3', score: 70 },
    { id: 8, name: 'asdf', score: 65 },
    { id: 9, name: '12345', score: 60 },
    { id: 10, name: 'asdfasdf', score: 55 },
  ]);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const response = await fetch('/auth/login', {
        method: 'GET',
      });

      if (!response.ok)
        console.log('Logout failed');

      navigate('/login');
    }
    catch (error) {
      console.error(error);
      navigate('/login');
    }
  };

  return (
    <div className="game-container">
      {/* Header/Navbar */}
      <header className="navbar">
        {/* 左侧头像 */}
        <div className="avatar"></div>

        {/* 中间玩家名称 */}
        <h1 className="player-name">Hello {playerName}</h1>

        {/* 右侧登录按钮 */}
        <button onClick={handleLogout} className="sign-in-button">
          Sign In
        </button>
      </header>

      {/* Game Content */}
      <div className="content">
        {/* Leaderboard */}
        <div className="leaderboard">
          {/* Score Board 标题 */}
          <div className="scoreboard-header">
            <h2 className="scoreboard-title">Score Board</h2>
          </div>

          {/* 排行榜列表 */}
          <div className="player-list">
            {leaderboard.map((player, index) => (
              <div key={player.id} className="player-item">
                {index + 1}. {player.name}
              </div>
            ))}
          </div>
        </div>

        {/* Game Area */}
        <div className="game-area">
          {/* 游戏内容将放在这里 */}
        </div>
      </div>
    </div>
  );
}