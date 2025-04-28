import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const [playerName, setPlayerName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const otherPlayersRef = useRef<{ x: number; y: number; color: string; username?: string }[]>([]);
  const [score, setScore]           = useState(0);
  const [snakeLengthState, setSnakeLengthState] = useState(1);


  const wsRef = useRef<WebSocket | null>(null);
  const playerNameRef = useRef<string>('');

  const location = useLocation();

  const snakeColorRef = useRef<string>(randomColor());
  // Game config
  const snakeRadius = 15;       // radius of each circle segment
  const segmentSpacing = snakeRadius * 1.6; // spacing between circles for overlap
  const speed = 1.5;              // px per frame
  const foodCount = 100;

  // Direction vector for movement (unit vector)
  const directionRef = useRef<Point>({ x: 1, y: 0 });
  // Snake segments positions (circle centers)
  const segmentsRef = useRef<Point[]>([]);
  // For spacing logic
  const lastPosRef = useRef<Point>({ x: 0, y: 0 });
  // Length in circles (initially 1)
  const lengthRef = useRef<number>(1);
  // Count of foods eaten
  const eatCountRef = useRef<number>(0);
  // Foods
  const foodsRef = useRef<Food[]>([]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/user/current', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const userData = await response.json();
          setPlayerName(userData.username);
          playerNameRef.current = userData.username;
        } else {
          console.error('Failed to fetch user data');
          navigate('/login');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchCurrentUser();
  }, []);

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // initialize head segment
    const start: Point = { x: canvas.width / 2, y: canvas.height / 2 };
    segmentsRef.current = [start];
    lastPosRef.current = start;
    // directionRef already set to default

    // scatter foods once
    foodsRef.current = Array.from({ length: foodCount }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      color: randomColor(),
    }));

    // animation loop
    const animate = () => {
      const head = segmentsRef.current[0];
      const dir = directionRef.current;
      // move head forward in current direction
      const newHead = { x: head.x + dir.x * speed, y: head.y + dir.y * speed };
      // ── APPEND THESE LINES TO KEEP THE HEAD INSIDE THE BORDER ──
      const minX = snakeRadius;
      const maxX = canvas.width  - snakeRadius;
      const minY = snakeRadius;
      const maxY = canvas.height - snakeRadius;

      newHead.x = Math.max(minX, Math.min(maxX, newHead.x));
      newHead.y = Math.max(minY, Math.min(maxY, newHead.y));

      // add new head circle only if beyond spacing
      const lastPos = lastPosRef.current;
      const dLast = Math.hypot(newHead.x - lastPos.x, newHead.y - lastPos.y);
      if (dLast >= segmentSpacing) {
        segmentsRef.current.unshift(newHead);
        lastPosRef.current = newHead;
      } else {
        segmentsRef.current[0] = newHead;
      }
      while (segmentsRef.current.length > lengthRef.current) {
        segmentsRef.current.pop();
      }

      // food collision and growth (grow by 1 circle every 5 foods eaten)
      foodsRef.current.forEach((f, idx) => {
        const d = Math.hypot(f.x - newHead.x, f.y - newHead.y);
        if (d < snakeRadius * 1.6) {
          // respawn this food
          foodsRef.current[idx] = {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            color: randomColor(),
          };
          // increment eat counter
          eatCountRef.current += 1;
          setScore(eatCountRef.current);
          // grow one circle when eatCount is multiple of 5
          if (eatCountRef.current % 5 === 0) {
            lengthRef.current += 1;
            setSnakeLengthState(lengthRef.current);
          }
        }
      });

      // drawing
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      foodsRef.current.forEach(f => {
        ctx.beginPath(); ctx.arc(f.x, f.y, snakeRadius * 0.3, 0, 2 * Math.PI);
        ctx.fillStyle = f.color; ctx.fill();
      });
    
      ctx.fillStyle = snakeColorRef.current;
      const segs = segmentsRef.current;
      for (let i = segs.length - 1; i >= 0; i--) {
        const p = segs[i];
        const t = i / segs.length;
        const r = snakeRadius * (1 - 0.3 * t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
        ctx.fill();
      }

      // username on the snake head
      if (segs.length > 0 && playerNameRef.current) {
        const head = segs[0]; 
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        
        const textY = head.y - snakeRadius - 3;
        
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(playerNameRef.current, head.x, textY); 
        
        ctx.fillStyle = 'white';
        ctx.fillText(playerNameRef.current, head.x, textY); 
      }

      otherPlayersRef.current.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, snakeRadius * 0.8, 0, 2 * Math.PI);
        ctx.fillStyle = p.color;
        ctx.fill();
        
        if (p.username) {
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          
          const textY = p.y - snakeRadius - 3;
          
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 3;
          ctx.strokeText(p.username, p.x, textY);
          
          ctx.fillStyle = 'white';
          ctx.fillText(p.username, p.x, textY);
        }
      });

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          messageType: 'move',
          snake_x:    segs[0].x,
          snake_y:    segs[0].y,
          snake_color: snakeColorRef.current,
          username: playerNameRef.current
        }));
      }

      requestAnimationFrame(animate);
    };
    animate();
  }, []);

  // mouse move to update direction continuously
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const onMouseMove = (e: MouseEvent) => {
      // get current head position
      const head = segmentsRef.current[0];
      const dx = (e.clientX - rect.left) - head.x;
      const dy = (e.clientY - rect.top) - head.y;
      const dist = Math.hypot(dx, dy) || 1;
      directionRef.current = { x: dx / dist, y: dy / dist };
    };
    canvas.addEventListener('mousemove', onMouseMove);
    return () => canvas.removeEventListener('mousemove', onMouseMove);
  }, []);
  
  useEffect(() => {
    if (location.pathname === '/game') {
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const socket = new WebSocket(`${scheme}://${window.location.host}/ws/game`);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('WebSocket connected');
        // send our initial head+color so server can record us
        const head = segmentsRef.current[0];
        socket.send(JSON.stringify({
          messageType: 'join',
          snake_x: head.x,
          snake_y: head.y,
          snake_color: snakeColorRef.current,
          username: playerNameRef.current
        }));
      };
      socket.onmessage = evt => {
        const data = JSON.parse(evt.data);

        if (data.messageType === 'init_location') {
          // seed all foods and all snakes
          foodsRef.current = data.foods;
          otherPlayersRef.current = data.snakes;
        }

        if (data.messageType === 'move') {
          // find existing or add new
          const idx = otherPlayersRef.current.findIndex(p => p.color === data.snake_color);
          if (idx >= 0) {
            otherPlayersRef.current[idx].x = data.snake_x;
            otherPlayersRef.current[idx].y = data.snake_y;
            otherPlayersRef.current[idx].username = data.username;
          } else {
            otherPlayersRef.current.push({
              x:     data.snake_x,
              y:     data.snake_y,
              color: data.snake_color,
              username: data.username
            });
          }
        }

        // you can handle further messageTypes (e.g. new_player, move, etc.) here
      };
      socket.onerror   = e => console.error(e);
      socket.onclose   = () => console.log('WS closed');

      return () => { socket.close(); };
    }
  }, [location.pathname, playerName]); 
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
    { id: 9, name: 'update docker', score: 60 },
    { id: 10, name: 'asdfasdftest', score: 55 },
  ]);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const response = await fetch('/auth/logout', {
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
          <div className="game-info">
            <div>Score: {score}</div>
            <div>Length: {snakeLengthState}</div>
          </div>
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}
