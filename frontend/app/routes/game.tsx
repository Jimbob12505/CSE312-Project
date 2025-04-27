import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/game.css';

// 2D point in pixels
type Point = { x: number; y: number };
// Food with color and position
type Food = Point & { color: string };

// Generate random hex color
function randomColor(): string {
  return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
}

export default function Game() {
  const [playerName] = useState('Playername');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Game config
  const snakeRadius = 18;   // head radius in px
  const speed = 1;          // px per frame
  const foodCount = 50;     // number of foods

  // Mouse target in pixel coords
  const targetRef = useRef<Point>({ x: 0, y: 0 });
  // Snake head position stored in ref
  const headRef = useRef<Point>({ x: 0, y: 0 });
  // Foods stored in ref to keep animation loop stable
  const foodsRef = useRef<Food[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);

  // Initialize canvas, snake, foods, and start animation (runs only once)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // start snake at center
    const start: Point = { x: canvas.width / 2, y: canvas.height / 2 };
    headRef.current = start;
    targetRef.current = start;

    // scatter food a single time
    const foodsArr: Food[] = Array.from({ length: foodCount }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      color: randomColor(),
    }));
    foodsRef.current = foodsArr;
    setFoods(foodsArr);

    // Animation loop: move head toward target and render
    const animate = () => {
      const head = headRef.current;
      const target = targetRef.current;
      // compute direction vector
      const dx = target.x - head.x;
      const dy = target.y - head.y;
      const dist = Math.hypot(dx, dy) || 1;
      const vx = (dx / dist) * speed;
      const vy = (dy / dist) * speed;
      // update head position
      headRef.current = { x: head.x + vx, y: head.y + vy };

      // clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // draw foods once scattered
      foodsRef.current.forEach(f => {
        ctx.beginPath();
        ctx.arc(f.x, f.y, snakeRadius * 0.3, 0, 2 * Math.PI);
        ctx.fillStyle = f.color;
        ctx.fill();
      });

      // draw snake head only
      const newHead = headRef.current;
      ctx.beginPath();
      ctx.arc(newHead.x, newHead.y, snakeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#06B4DB';
      ctx.fill();

      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, []);

  // Track mouse to update target continuously
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const onMouseMove = (e: MouseEvent) => {
      targetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    canvas.addEventListener('mousemove', onMouseMove);
    return () => canvas.removeEventListener('mousemove', onMouseMove);
  }, []);
  //
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
          Logout
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
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}