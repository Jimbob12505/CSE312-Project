import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#AF46A3]">
      <div className="flex-grow flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg text-center">
          <h1 className="text-7xl font-bold text-white mb-10 tracking-wider" style={{ 
            fontFamily: '"Audiowide", "Orbitron", cursive', 
            textShadow: '0 0 10px rgba(6, 180, 219, 0.7), 0 0 20px rgba(6, 180, 219, 0.5)'
          }}>
            wigglewars.me
          </h1>
          
          <p className="text-white text-xl mb-12 opacity-90">
            Real-time multiplayer snake game!
          </p>
          
          <Link 
            to="/login" 
            className="inline-block bg-[#06B4DB] hover:bg-[#24D2F9] text-white font-bold py-5 px-12 rounded-full transition-all duration-300 transform hover:scale-105 text-2xl shadow-xl"
          >
            Play Now
          </Link>
        </div>
      </div>
    </div>
  );
}
