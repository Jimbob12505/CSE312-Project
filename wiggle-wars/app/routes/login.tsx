import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
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

      if (!response.ok) {
        throw new Error('Login failed');
      }

      // Handle successful login
      console.log('Login successful');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-md w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4 text-center">Login to Your Game Account</h2>
        <div className="mb-4">
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full">Login</Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full mt-2 text-blue-500"
          onClick={() => navigate('/register')}
        >
          Register
        </Button>
      </form>
    </div>
  );
};

export const Component = LoginPage;
