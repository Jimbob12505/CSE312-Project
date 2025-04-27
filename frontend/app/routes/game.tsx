import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/game.css';

// Grid coordinate
interface Segment { x: number; y: number; }
// Food with color
interface Food extends Segment { color: string; }

// Generate a random hex color
function randomColor(): string {
  return '#' + Math.floor(Math.random() * 0xFFFFFF)
      .toString(16)
      .padStart(6, '0');
}

// Get a random grid cell not in `occupied`
function randomCell(cols: number, rows: number, occupied: Segment[]): Segment {
  let cell: Segment;
  do {
    cell = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
  } while (occupied.some(o => o.x === cell.x && o.y === cell.y));
  return cell;
}

export default function Game() {
  const [playerName] = useState('Playername');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cellSize = 40;
  const foodCount = 50;

  // dynamic grid dimensions
  const [cols, setCols] = useState(0);
  const [rows, setRows] = useState(0);

  // snake state (initialized once)
  const [snake, setSnake] = useState<Segment[]>([]);
  // foods state (array of colored positions)
  const [food, setFood] = useState<Food[]>([]);

  // on mount: measure grid, set canvas size, init snake & foods
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement!;
    const c = Math.floor(container.clientWidth  / cellSize);
    const r = Math.floor(container.clientHeight / cellSize);
    setCols(c);
    setRows(r);
    canvas.width = c * cellSize;
    canvas.height = r * cellSize;

    // center snake
    const center: Segment = { x: Math.floor(c / 2), y: Math.floor(r / 2) };
    setSnake([center]);

    // scatter foods
    const foods: Food[] = Array.from({ length: foodCount }).map(() => {
      const cell = randomCell(c, r, [center]);
      return { ...cell, color: randomColor() };
    });
    setFood(foods);
  }, []);

  // draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // draw snake
      const snakeRadius = (cellSize * 0.9) / 2;
      ctx.fillStyle = '#06B4DB';
      snake.forEach(seg => {
        ctx.beginPath();
        ctx.arc(
            seg.x * cellSize + cellSize / 2,
            seg.y * cellSize + cellSize / 2,
            snakeRadius,
            0,
            2 * Math.PI
        );
        ctx.fill();
      });

      // draw foods
      const foodRadius = (cellSize * 0.3) / 2;
      food.forEach(f => {
        ctx.beginPath();
        ctx.fillStyle = f.color;
        ctx.arc(
            f.x * cellSize + cellSize / 2,
            f.y * cellSize + cellSize / 2,
            foodRadius,
            0,
            2 * Math.PI
        );
        ctx.fill();
      });

      requestAnimationFrame(render);
    };
    render();
  }, [snake, food]);
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