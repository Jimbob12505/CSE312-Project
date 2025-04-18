// Get the canvas and context
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Set canvas dimensions to fill the window
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Define the snake with a body segments array and starting length
let snake = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 10,
  speed: 2,
  angle: 0,
  segments: [],
  maxLength: 20, // The starting number of segments
};

// Initialize the snake segments with the starting position
for (let i = 0; i < snake.maxLength; i++) {
  snake.segments.push({ x: snake.x, y: snake.y });
}

// Array to hold food items
let foods = [];

// Function to spawn a food item at a random position on the canvas
function spawnFood() {
  const food = {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: 5, // Adjust the size as needed
  };
  foods.push(food);
}

// Spawn some food items at the start
for (let i = 0; i < 10; i++) {
  spawnFood();
}

// Spawn new food items continuously (every 1 second)
setInterval(spawnFood, 1000);

// Function to update the game state
function update() {
  // Move the snake's head based on its current direction
  snake.x += Math.cos(snake.angle) * snake.speed;
  snake.y += Math.sin(snake.angle) * snake.speed;

  // Wrap the snake around the screen (world wrapping)
  if (snake.x > canvas.width) snake.x = 0;
  if (snake.x < 0) snake.x = canvas.width;
  if (snake.y > canvas.height) snake.y = 0;
  if (snake.y < 0) snake.y = canvas.height;

  // Add the new head position to the start of the segments array
  snake.segments.unshift({ x: snake.x, y: snake.y });

  // Keep the snake segments to the allowed maxLength
  if (snake.segments.length > snake.maxLength) {
    snake.segments.pop();
  }

  // Check for collision between snake's head and each food item
  for (let i = foods.length - 1; i >= 0; i--) {
    const food = foods[i];
    const dx = snake.x - food.x;
    const dy = snake.y - food.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < snake.radius + food.radius) {
      // =========================
      // >>>>> SNAKE GROWTH CODE START <<<<<

      // Remove the food item that was eaten
      foods.splice(i, 1);
      // Increase the snake's allowed length (growth)
      growSnake();

      // >>>>> SNAKE GROWTH CODE END <<<<<
      // =========================
    }
  }
}

// Function to increase the snake's maxLength, making it grow
function growSnake() {
  snake.maxLength += 1;
}

// Function to draw the snake and food items
function draw() {
  // Clear the canvas before drawing the new frame
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the snake's body by iterating over all segments
  ctx.fillStyle = "#00FF00"; // Snake's color
  for (const seg of snake.segments) {
    ctx.beginPath();
    ctx.arc(seg.x, seg.y, snake.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }

  // Draw each food item as a red circle
  ctx.fillStyle = "#FF0000"; // Food color
  for (const food of foods) {
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }
}

// Main game loop: updates the game state and draws the frame
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Event listener for mouse movement to change the snake's direction
canvas.addEventListener("mousemove", (event) => {
  const dx = event.clientX - snake.x;
  const dy = event.clientY - snake.y;
  snake.angle = Math.atan2(dy, dx);
});

// Adjust the canvas if the window is resized
window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// Start the game loop
gameLoop();
