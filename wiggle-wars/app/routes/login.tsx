import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const endpoint = isLogin ? '/api/login' : '/api/register';

    try {
      // Note: This is a placeholder for actual API call
      console.log(`Would send to ${endpoint}: ${payload}`);
      
      // In a real implementation, we would make an actual API call
      // const response = await fetch(endpoint, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/x-www-form-urlencoded',
      //   },
      //   body: payload
      // });
      
      // if (response.ok) {
      //   navigate('/game');
      // }
      
      // For development, just navigate to the game page
      navigate('/game');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#AF46A3]">
      <div className="flex-grow flex flex-col items-center justify-center p-4">
        {/* Title */}
        <h1 className="text-7xl font-bold text-white mb-8 tracking-wider" style={{ 
          fontFamily: '"Audiowide", "Orbitron", cursive', 
          textShadow: '0 0 10px rgba(6, 180, 219, 0.7), 0 0 20px rgba(6, 180, 219, 0.5)'
        }}>
          wigglewars.me
        </h1>
        
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-8">
            <div className="flex mb-6 border-b">
              <button
                className={`pb-2 px-4 ${isLogin ? 'border-b-2 border-[#06B4DB] text-[#06B4DB] font-bold' : 'text-gray-500'}`}
                onClick={() => setIsLogin(true)}
              >
                Login
              </button>
              <button
                className={`pb-2 px-4 ${!isLogin ? 'border-b-2 border-[#06B4DB] text-[#06B4DB] font-bold' : 'text-gray-500'}`}
                onClick={() => setIsLogin(false)}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-2">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#06B4DB]"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              
              <div className="mb-6">
                <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#06B4DB]"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-[#06B4DB] hover:bg-[#24D2F9] text-white font-bold py-3 px-4 rounded-full transition-colors"
              >
                {isLogin ? 'Login' : 'Register'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}