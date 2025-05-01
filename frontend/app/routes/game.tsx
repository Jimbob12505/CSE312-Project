import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/game.css';

// 2D point in pixels
type Point = { x: number; y: number };
// Food with color and position
type Food = Point & { color: string; id: string; active: boolean };
// Snake type with complete information
type Snake = {
  id: string;
  x: number;
  y: number;
  color: string;
  username?: string;
  segments: Point[];
  length: number;
  score: number;
  alive: boolean;
};

// Game world and viewport configuration
const WORLD_WIDTH = 2400;  // Reduced world width - about 2x screen size
const WORLD_HEIGHT = 1600; // Reduced world height - about 2x screen size
const VIEWPORT_WIDTH = 1200; // Visible area width
const VIEWPORT_HEIGHT = 800; // Visible area height
const BORDER_THICKNESS = 20; // Thickness of the world border

// Generate random hex color
function randomColor(): string {
  return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
}

export default function Game() {
  const [playerName, setPlayerName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const otherPlayersRef = useRef<Snake[]>([]);
  const [score, setScore]   = useState(0);
  const [snakeLengthState, setSnakeLengthState] = useState(1);
  const [isAlive, setIsAlive] = useState(true);

  // Camera tracking
  const cameraRef = useRef<Point>({ x: 0, y: 0 });
  const worldToCanvas = (worldPos: Point): Point => {
    return {
      x: worldPos.x - cameraRef.current.x,
      y: worldPos.y - cameraRef.current.y
    };
  };
  const canvasToWorld = (canvasPos: Point): Point => {
    return {
      x: canvasPos.x + cameraRef.current.x,
      y: canvasPos.y + cameraRef.current.y
    };
  };

  const wsRef = useRef<WebSocket | null>(null);
  const playerNameRef = useRef<string>('');
  const playerIdRef = useRef<string>('');

  const location = useLocation();

  const snakeColorRef = useRef<string>(randomColor());
  // Game config
  const snakeRadius = 15;       // radius of each circle segment
  const segmentSpacing = snakeRadius * 1.6; // spacing between circles for overlap
  const speed = 1.2;              // px per frame - approximately 200px per second at 60fps (60 * 1.2 = 180px/s)
  const foodCount = 100;
  const collisionDistance = snakeRadius * 1.5; // Distance for collision detection

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
  // Is player alive
  const aliveRef = useRef<boolean>(true);
  // Time of death to handle respawn
  const deathTimeRef = useRef<number | null>(null);
  // Respawn timer
  const respawnTimerRef = useRef<number | null>(null);

  // Added WebSocket reconnection counter
  const reconnectCount = useRef<number>(0);
  const maxReconnects = 5;
  const reconnectDelay = 2000;
  
  // Added variables to limit sending frequency 
  const lastSendTime = useRef<number>(0);
  const sendInterval = 50; // Limit to 50ms per update, about 20fps
  const sendPositionThreshold = 5; // Only send update if moved more than 5px
  const lastSentPos = useRef<Point | null>(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/user/current', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const userData = await response.json();
          setPlayerName(userData.username);
          playerNameRef.current = userData.username;
          playerIdRef.current = userData.id;
          
          console.log(`User authenticated: ${userData.username}, ID: ${userData.id}`);
          
          // Initialize WebSocket connection only after we have the player ID
          if (location.pathname === '/game' && !wsRef.current) {
            const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
            const socket = new WebSocket(`${scheme}://${window.location.host}/ws/game`);
            wsRef.current = socket;
            
            initializeWebSocketHandlers(socket);
          }
        } else {
          navigate('/login');
        }
      } catch (error) {
        navigate('/login');
      }
    };

    fetchCurrentUser();
  }, []);

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  // Helper function to check collision between two points with radius
  const checkCollision = (p1: Point, p2: Point, distance: number): boolean => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.hypot(dx, dy) < distance;
  };

  // Helper function to check if a world position is in the viewport
  const isInViewport = (worldPos: Point): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    
    const padding = snakeRadius * 2; // Extra padding to ensure objects are fully visible
    
    return (
      worldPos.x >= cameraRef.current.x - padding && 
      worldPos.x <= cameraRef.current.x + canvas.width + padding &&
      worldPos.y >= cameraRef.current.y - padding && 
      worldPos.y <= cameraRef.current.y + canvas.height + padding
    );
  };
  
  // Draw the world borders
  const drawWorldBorders = (ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    ctx.fillStyle = 'rgba(100, 149, 237, 0.4)'; // Soft cornflower blue with transparency
    
    // Draw borders that are in the viewport
    const camera = cameraRef.current;
    
    // Top border
    if (camera.y <= BORDER_THICKNESS) {
      ctx.fillRect(0, 0, canvas.width, BORDER_THICKNESS - camera.y);
    }
    
    // Bottom border
    if (camera.y + canvas.height >= WORLD_HEIGHT - BORDER_THICKNESS) {
      const y = WORLD_HEIGHT - BORDER_THICKNESS - camera.y;
      ctx.fillRect(0, y, canvas.width, BORDER_THICKNESS + (canvas.height - (WORLD_HEIGHT - camera.y)));
    }
    
    // Left border
    if (camera.x <= BORDER_THICKNESS) {
      ctx.fillRect(0, 0, BORDER_THICKNESS - camera.x, canvas.height);
    }
    
    // Right border
    if (camera.x + canvas.width >= WORLD_WIDTH - BORDER_THICKNESS) {
      const x = WORLD_WIDTH - BORDER_THICKNESS - camera.x;
      ctx.fillRect(x, 0, BORDER_THICKNESS + (canvas.width - (WORLD_WIDTH - camera.x)), canvas.height);
    }
  };

  // Function to handle player death
  const handleDeath = () => {
    if (!aliveRef.current) return; // Don't handle death multiple times
    
    aliveRef.current = false;
    setIsAlive(false);
    deathTimeRef.current = Date.now();
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        messageType: 'player_died',
        snake_id: playerIdRef.current,
        segments: segmentsRef.current,
        color: snakeColorRef.current
      }));
    }
    
    // Clear segments and prepare for respawn
    segmentsRef.current = [];
    
    // Set respawn timer
    respawnTimerRef.current = window.setTimeout(() => {
      respawnPlayer();
    }, 3000);
  };

  // Function to respawn player
  const respawnPlayer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Reset to center of world
    const start: Point = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    segmentsRef.current = [start];
    lastPosRef.current = start;
    
    // Reset camera
    updateCamera(start);
    
    // Reset length and score
    lengthRef.current = 1;
    setSnakeLengthState(1);
    eatCountRef.current = 0;
    setScore(0);
    
    // Get new random color
    snakeColorRef.current = randomColor();
    
    // Mark as alive
    aliveRef.current = true;
    setIsAlive(true);
    deathTimeRef.current = null;
    
    // Send respawn event to server
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        messageType: 'respawn',
        snake_x: start.x,
        snake_y: start.y,
        snake_color: snakeColorRef.current,
        username: playerNameRef.current
      }));
    }
  };

  // Update camera position to follow player
  const updateCamera = (head: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Adjust viewport based on canvas size
    const viewportWidth = canvas.width;
    const viewportHeight = canvas.height;
    
    // Center the camera on the player
    cameraRef.current = {
      x: head.x - viewportWidth / 2,
      y: head.y - viewportHeight / 2
    };
    
    // Clamp camera to world boundaries
    cameraRef.current.x = Math.max(0, Math.min(WORLD_WIDTH - viewportWidth, cameraRef.current.x));
    cameraRef.current.y = Math.max(0, Math.min(WORLD_HEIGHT - viewportHeight, cameraRef.current.y));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    
    // Set to fill parent container completely
    const resizeCanvas = () => {
      // Save current camera center position
      let centerX = 0, centerY = 0;
      
      if (segmentsRef.current.length > 0) {
        const head = segmentsRef.current[0];
        centerX = head.x;
        centerY = head.y;
      } else if (cameraRef.current) {
        // If no head, use camera center point
        centerX = cameraRef.current.x + (canvas.width / 2);
        centerY = cameraRef.current.y + (canvas.height / 2);
      }
      
      // Update canvas size
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      
      // Readjust camera, keeping original center point
      if (segmentsRef.current.length > 0) {
        updateCamera(segmentsRef.current[0]);
      } else if (centerX && centerY) {
        cameraRef.current = {
          x: centerX - (canvas.width / 2),
          y: centerY - (canvas.height / 2)
        };
        
        // Ensure camera is within world boundaries
        cameraRef.current.x = Math.max(0, Math.min(WORLD_WIDTH - canvas.width, cameraRef.current.x));
        cameraRef.current.y = Math.max(0, Math.min(WORLD_HEIGHT - canvas.height, cameraRef.current.y));
      }
    };
    
    // Initial size adjustment
    resizeCanvas();
    
    // Add window resize listener
    window.addEventListener('resize', resizeCanvas);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // initialize head segment at center of world
    const start: Point = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    segmentsRef.current = [start];
    lastPosRef.current = start;
    
    // Initialize camera position
    cameraRef.current = {
      x: start.x - canvas.width / 2,
      y: start.y - canvas.height / 2
    };
    
    // Ensure camera is within world boundaries
    cameraRef.current.x = Math.max(0, Math.min(WORLD_WIDTH - canvas.width, cameraRef.current.x));
    cameraRef.current.y = Math.max(0, Math.min(WORLD_HEIGHT - canvas.height, cameraRef.current.y));

    // animation loop
    const animate = () => {
      // Skip movement if dead, just render
      if (!aliveRef.current) {
        // Draw death state
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw world borders
        drawWorldBorders(ctx);
        
        // Draw foods
        foodsRef.current.forEach((f: Food) => {
          if (f.active) {
            const canvasPos = worldToCanvas(f);
            if (isInViewport(f)) {
              ctx.beginPath(); 
              ctx.arc(canvasPos.x, canvasPos.y, snakeRadius * 0.3, 0, 2 * Math.PI);
              ctx.fillStyle = f.color; 
              ctx.fill();
            }
          }
        });
        
        // Draw other players
        drawOtherPlayers(ctx);
        
        // Draw respawn message
        if (deathTimeRef.current) {
          const respawnTime = Math.max(0, 3 - Math.floor((Date.now() - deathTimeRef.current) / 1000));
          
          ctx.font = 'bold 36px Arial';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'red';
          ctx.fillText('You died!', canvas.width / 2, canvas.height / 2 - 20);
          ctx.fillText(`Respawning in ${respawnTime}...`, canvas.width / 2, canvas.height / 2 + 20);
        }
        
        requestAnimationFrame(animate);
        return;
      }

      const head = segmentsRef.current[0];
      const dir = directionRef.current;
      // move head forward in current direction
      const newHead = { x: head.x + dir.x * speed, y: head.y + dir.y * speed };
      
      // ── KEEP THE HEAD INSIDE THE WORLD BORDER ──
      const minX = BORDER_THICKNESS + snakeRadius;
      const maxX = WORLD_WIDTH - BORDER_THICKNESS - snakeRadius;
      const minY = BORDER_THICKNESS + snakeRadius;
      const maxY = WORLD_HEIGHT - BORDER_THICKNESS - snakeRadius;
      
      // Check for wall collision
      const hitWall = newHead.x <= minX || newHead.x >= maxX || newHead.y <= minY || newHead.y >= maxY;
      
      if (hitWall) {
        // Bounce off walls
        if (newHead.x <= minX || newHead.x >= maxX) {
          directionRef.current.x *= -0.5;
        }
        if (newHead.y <= minY || newHead.y >= maxY) {
          directionRef.current.y *= -0.5;
        }
        
        // Enforce boundaries
        newHead.x = Math.max(minX, Math.min(maxX, newHead.x));
        newHead.y = Math.max(minY, Math.min(maxY, newHead.y));
      }
      
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
      
      // Update camera to follow player
      updateCamera(newHead);
      
      // Check collision with other players
      for (const otherSnake of otherPlayersRef.current) {
        // 必须确保与我们比较的是有效的蛇，并且是活着的
        if (!otherSnake || !otherSnake.alive || !otherSnake.segments || !otherSnake.id) continue;
        
        // 再次确认不是与自己碰撞
        if (playerIdRef.current && otherSnake.id === playerIdRef.current) continue;
        
        // Head-to-head collision
        if (otherSnake.segments.length > 0) {
          const otherHead = otherSnake.segments[0];
          if (checkCollision(newHead, otherHead, collisionDistance)) {
            handleDeath();
            requestAnimationFrame(animate);
            return;
          }
          
          // Check collision with other snake's segments (skipping head)
          for (let i = 1; i < otherSnake.segments.length; i++) {
            if (checkCollision(newHead, otherSnake.segments[i], collisionDistance * 0.8)) {
              handleDeath();
              requestAnimationFrame(animate);
              return;
            }
          }
        }
      }

      // food collision and growth (grow by 1 circle every 3 foods eaten)
      foodsRef.current.forEach((f, idx) => {
        if (!f.active) return;
        
        const d = Math.hypot(f.x - newHead.x, f.y - newHead.y);
        if (d < snakeRadius * 1.6) {
          f.active = false;
          
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              messageType: 'eat_food',
              food_id: f.id
            }));
          }
          
          // increment eat counter
          eatCountRef.current += 1;
          setScore(eatCountRef.current);
          // grow one circle when eatCount is multiple of 3
          if (eatCountRef.current % 3 === 0) {
            lengthRef.current += 1;
            setSnakeLengthState(lengthRef.current);
          }
        }
      });

      // drawing
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw world borders
      drawWorldBorders(ctx);
      
      foodsRef.current.forEach(f => {
        if (f.active && isInViewport(f)) {
          const canvasPos = worldToCanvas(f);
          ctx.beginPath(); 
          ctx.arc(canvasPos.x, canvasPos.y, snakeRadius * 0.3, 0, 2 * Math.PI);
          ctx.fillStyle = f.color; 
          ctx.fill();
        }
      });
    
      // Draw player snake
      ctx.fillStyle = snakeColorRef.current;
      const segs = segmentsRef.current;
      for (let i = segs.length - 1; i >= 0; i--) {
        const p = segs[i];
        const canvasPos = worldToCanvas(p);
        const t = i / segs.length;
        const r = snakeRadius * (1 - 0.3 * t);
        ctx.beginPath();
        ctx.arc(canvasPos.x, canvasPos.y, r, 0, 2 * Math.PI);
        ctx.fill();
      }

      // username on the snake head
      if (segs.length > 0 && playerNameRef.current) {
        const head = segs[0]; 
        const headCanvasPos = worldToCanvas(head);
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        
        const textY = headCanvasPos.y - snakeRadius - 3;
        
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(playerNameRef.current, headCanvasPos.x, textY); 
        
        ctx.fillStyle = 'white';
        ctx.fillText(playerNameRef.current, headCanvasPos.x, textY); 
      }

      // Draw other players
      drawOtherPlayers(ctx);

      if (wsRef.current?.readyState === WebSocket.OPEN && aliveRef.current) {
        const currentTime = Date.now();
        const head = segs[0];
        
        // Calculate distance from last sent position
        let shouldSend = false;
        
        if (!lastSentPos.current) {
          shouldSend = true;
        } else {
          const dx = head.x - lastSentPos.current.x;
          const dy = head.y - lastSentPos.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          shouldSend = dist > sendPositionThreshold;
        }
        
        // Check if we should send an update (based on time and position change)
        if (shouldSend && currentTime - lastSendTime.current > sendInterval) {
          lastSendTime.current = currentTime;
          lastSentPos.current = { x: head.x, y: head.y };
          
          wsRef.current.send(JSON.stringify({
            messageType: 'move',
            snake_x: head.x,
            snake_y: head.y,
            snake_color: snakeColorRef.current,
            username: playerNameRef.current,
            segments: segs,
            length: lengthRef.current,
            score: eatCountRef.current,
            alive: aliveRef.current
          }));
        }
      }

      requestAnimationFrame(animate);
    };
    
    // Function to draw other players
    const drawOtherPlayers = (ctx: CanvasRenderingContext2D) => {
      otherPlayersRef.current.forEach(snake => {
        // Dead snake particles
        if (!snake.alive && snake.segments && snake.segments.length > 0) {
          for (let i = 0; i < snake.segments.length; i += 3) {
            const p = snake.segments[i];
            if (isInViewport(p)) {
              const canvasPos = worldToCanvas(p);
              ctx.beginPath();
              ctx.arc(canvasPos.x, canvasPos.y, snakeRadius * 0.3, 0, 2 * Math.PI);
              ctx.fillStyle = snake.color;
              ctx.fill();
            }
          }
          return;
        }
        
        // Living snake with segments
        if (snake.segments && snake.segments.length > 0) {
          let hasVisibleSegments = false;
          
          for (let i = snake.segments.length - 1; i >= 0; i--) {
            const p = snake.segments[i];
            if (isInViewport(p)) {
              hasVisibleSegments = true;
              const canvasPos = worldToCanvas(p);
              const t = i / snake.segments.length;
              const r = snakeRadius * (1 - 0.3 * t);
              
              ctx.beginPath();
              ctx.arc(canvasPos.x, canvasPos.y, r, 0, 2 * Math.PI);
              ctx.fillStyle = snake.color;
              ctx.fill();
            }
          }
          
          // Only draw username if snake has visible segments
          if (hasVisibleSegments && snake.username && snake.alive && snake.segments.length > 0) {
            const head = snake.segments[0];
            const headCanvasPos = worldToCanvas(head);
            
            if (isInViewport(head)) {
              ctx.font = 'bold 14px Arial';
              ctx.textAlign = 'center';
              
              const textY = headCanvasPos.y - snakeRadius - 3;
              
              ctx.strokeStyle = 'black';
              ctx.lineWidth = 3;
              ctx.strokeText(snake.username, headCanvasPos.x, textY);
              
              ctx.fillStyle = 'white';
              ctx.fillText(snake.username, headCanvasPos.x, textY);
            }
          }
        } 
        // Single point snake (fallback)
        else if (isInViewport(snake)) {
          const canvasPos = worldToCanvas(snake);
          ctx.beginPath();
          ctx.arc(canvasPos.x, canvasPos.y, snakeRadius * 0.8, 0, 2 * Math.PI);
          ctx.fillStyle = snake.color;
          ctx.fill();
          
          if (snake.username && snake.alive) {
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            
            const textY = canvasPos.y - snakeRadius - 3;
            
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.strokeText(snake.username, canvasPos.x, textY);
            
            ctx.fillStyle = 'white';
            ctx.fillText(snake.username, canvasPos.x, textY);
          }
        }
      });
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (respawnTimerRef.current) {
        clearTimeout(respawnTimerRef.current);
      }
    };
  }, []);

  // mouse move to update direction continuously
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const onMouseMove = (e: MouseEvent) => {
      if (!aliveRef.current) return; // Don't update direction if dead
      
      const rect = canvas.getBoundingClientRect();
      // Get mouse position in canvas coordinates
      const canvasMouseX = e.clientX - rect.left;
      const canvasMouseY = e.clientY - rect.top;
      
      // Convert to world coordinates
      const worldMousePos = canvasToWorld({ x: canvasMouseX, y: canvasMouseY });
      
      // Get current head position in world coordinates
      const head = segmentsRef.current[0];
      const dx = worldMousePos.x - head.x;
      const dy = worldMousePos.y - head.y;
      const dist = Math.hypot(dx, dy) || 1;
      
      // Update direction as a unit vector
      directionRef.current = { x: dx / dist, y: dy / dist };
    };
    
    canvas.addEventListener('mousemove', onMouseMove);
    return () => canvas.removeEventListener('mousemove', onMouseMove);
  }, []);
  
  // WebSocket handler initialization function
  const initializeWebSocketHandlers = (socket: WebSocket) => {
    socket.onopen = () => {
      console.log("WebSocket connection established");
      // Reset reconnect counter
      reconnectCount.current = 0;
      
      // Ensure we have player ID
      if (!playerIdRef.current) {
        console.log("No player ID available, cannot join game");
        return;
      }
      
      // Send initial data
      const head = segmentsRef.current[0];
      socket.send(JSON.stringify({
        messageType: 'join',
        snake_x: head.x,
        snake_y: head.y,
        snake_color: snakeColorRef.current,
        username: playerNameRef.current,
        alive: true
      }));
    };
    
    socket.onmessage = evt => {
      const data = JSON.parse(evt.data);

      if (data.messageType === 'init_location') {
        foodsRef.current = data.foods;
        
        // Make sure we have playerIdRef.current and filter out our own snake
        if (playerIdRef.current) {
          otherPlayersRef.current = data.snakes.filter(
            (snake: Snake) => snake.id !== playerIdRef.current
          );
        } else {
          // If no ID yet, store all snakes
          otherPlayersRef.current = data.snakes;
        }
      }
      else if (data.messageType === 'heartbeat') {
        // Respond to server heartbeat
        socket.send(JSON.stringify({
          messageType: 'heartbeat_response'
        }));
      }
      else if (data.messageType === 'snake_joined' || data.messageType === 'snake_update') {
        const snake = data.snake;
        
        // Ensure we don't add ourselves to the other snakes list
        if (playerIdRef.current && snake.id === playerIdRef.current) return;
        
        const idx = otherPlayersRef.current.findIndex(p => p.id === snake.id);
        
        if (idx >= 0) {
          otherPlayersRef.current[idx] = snake;
        } else {
          otherPlayersRef.current.push(snake);
        }
      }
      else if (data.messageType === 'snake_left') {
        const snake_id = data.snake_id;
        otherPlayersRef.current = otherPlayersRef.current.filter(
          snake => snake.id !== snake_id
        );
      }
      else if (data.messageType === 'player_died') {
        const snakeId = data.snake_id;
        
        // Check if it's our own death message
        if (playerIdRef.current && snakeId === playerIdRef.current) {
          // Server thinks we're dead, ensure local state matches
          if (aliveRef.current) {
            // If local state is still alive, call the death handler
            handleDeath();
          }
          return;
        }
        
        const idx = otherPlayersRef.current.findIndex(p => p.id === snakeId);
        
        if (idx >= 0) {
          otherPlayersRef.current[idx].alive = false;
          // Add death animation/particles here if desired
        }
        
        // If death converted to food particles
        if (data.food_particles && Array.isArray(data.food_particles)) {
          foodsRef.current = [...foodsRef.current, ...data.food_particles];
        }
      }
      else if (data.messageType === 'food_update') {
        const foodId = data.food_id;
        const isActive = data.active;
      
        const foodIdx = foodsRef.current.findIndex(f => f.id === foodId);
        if (foodIdx >= 0) {
          foodsRef.current[foodIdx].active = isActive;
        }
      }
      else if (data.messageType === 'new_foods') {
        if (data.foods && Array.isArray(data.foods)) {
          foodsRef.current = [...foodsRef.current, ...data.foods];
        }
      }
      else if (data.messageType === 'leaderboard_update') {
        // Update leaderboard with real-time data
        if (data.leaderboard && Array.isArray(data.leaderboard)) {
          setLeaderboard(prevLeaderboard => {
            const currentJson = JSON.stringify(prevLeaderboard);
            const newJson = JSON.stringify(data.leaderboard);
            if (currentJson !== newJson) {
              return data.leaderboard;
            }
            return prevLeaderboard;
          });
        }
      }
    };
    
    socket.onerror = e => { 
      console.error("WebSocket error:", e);
    };
    
    socket.onclose = (event) => {
      console.log(`WebSocket closed: ${event.code} ${event.reason}`);
      
      // If not cleanly closed and not exceeded max reconnect attempts, try reconnecting
      if (!event.wasClean && reconnectCount.current < maxReconnects) {
        const delay = reconnectDelay * Math.pow(1.5, reconnectCount.current);
        console.log(`Attempting to reconnect in ${delay}ms...`);
        
        reconnectCount.current += 1;
        setTimeout(() => {
          if (location.pathname === '/game') {
            const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
            const socket = new WebSocket(`${scheme}://${window.location.host}/ws/game`);
            wsRef.current = socket;
            
            initializeWebSocketHandlers(socket);
          }
        }, delay);
      }
    };
  };

  // Clean up WebSocket connection
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        console.log("Closing WebSocket connection");
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Initialize empty leaderboard (will be populated from WebSocket)
  const [leaderboard, setLeaderboard] = useState<Array<{id: string, name: string, score: number}>>([]);

  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const response = await fetch('/auth/logout', {
        method: 'GET',
      });

      if (!response.ok) {
        // Silent failure
      }

      navigate('/login');
    }
    catch (error) {
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
            {leaderboard.length > 0 ? (
              leaderboard.map((player, index) => (
                <div key={player.id} className="player-item">
                  {index + 1}. {player.name}: {player.score}
                </div>
              ))
            ) : (
              <div className="player-item">No players yet</div>
            )}
          </div>
        </div>

        {/* Game Area */}
        <div className="game-area">
          <div className="game-info">
            <div>Score: {score}</div>
            <div>Length: {snakeLengthState}</div>
            {!isAlive && <div className="status-dead">DEAD</div>}
          </div>
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}