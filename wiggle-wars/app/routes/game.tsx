import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Game() {
  const [playerName, setPlayerName] = useState('Playername');
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
  
  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex justify-between items-center p-2 bg-[#AF46A3] text-white">
        <div className="w-[60px] h-[60px] rounded-full bg-[#D782CF] flex items-center justify-center">
        </div>
        
        <h1 className="text-xl font-bold">Hello {playerName}</h1>
        
        <button 
          onClick={handleLogout}
          className="bg-[#06B4DB] hover:bg-[#24D2F9] px-6 py-2 rounded-full transition-colors"
        >
          Sign In
        </button>
      </header>

      <div className="flex flex-1">
        <div className="w-[176px] bg-[#AF46A3] text-white overflow-y-auto">
          <div className="bg-[#06B4DB] p-2">
            <h2 className="font-bold">Score Board</h2>
          </div>
          
          <div className="p-4">
            {leaderboard.map((player, index) => (
              <div key={player.id} className="py-1">
                {index + 1}. {player.name}
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 bg-white">
        </div>
      </div>
    </div>
  );
}