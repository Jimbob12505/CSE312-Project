import json
import threading
import time
import random
import hashlib
import database as db
from flask import request

active_connections = {}
snake_positions = {}
food_state = {}
last_food_sync = 0
MAX_FOODS = 300
WORLD_WIDTH = 2400
WORLD_HEIGHT = 1600
BORDER_THICKNESS = 20
food_id_counter = 0
food_spawn_thread = None

def generate_foods(count=100, min_x=BORDER_THICKNESS+20, max_x=WORLD_WIDTH-BORDER_THICKNESS-20, min_y=BORDER_THICKNESS+20, max_y=WORLD_HEIGHT-BORDER_THICKNESS-20):
    food_items = {}
    global food_id_counter
    
    # Divide world into grid for even food distribution
    grid_size = 200  # Grid size
    grid_cols = (max_x - min_x) // grid_size
    grid_rows = (max_y - min_y) // grid_size
    
    # Ensure enough grid cells for all food
    total_cells = grid_cols * grid_rows
    if total_cells < count:
        grid_size = min(100, (max_x - min_x) // int((count)**0.5))
        grid_cols = (max_x - min_x) // grid_size
        grid_rows = (max_y - min_y) // grid_size
    
    # Place food randomly, but try to have at least one per grid cell
    cells_with_food = set()
    
    for i in range(count):
        food_id = str(food_id_counter)
        food_id_counter += 1
        
        # Fill empty grid cells first
        if len(cells_with_food) < grid_cols * grid_rows and len(cells_with_food) < count:
            # Find a grid without food
            while True:
                grid_x = random.randint(0, grid_cols-1)
                grid_y = random.randint(0, grid_rows-1)
                cell_id = grid_y * grid_cols + grid_x
                
                if cell_id not in cells_with_food:
                    cells_with_food.add(cell_id)
                    break
            
            # Place food randomly within the chosen grid
            x = min_x + grid_x * grid_size + random.uniform(10, grid_size-10)
            y = min_y + grid_y * grid_size + random.uniform(10, grid_size-10)
        else:
            # If all grids have food, place completely randomly
            x = random.uniform(min_x, max_x)
            y = random.uniform(min_y, max_y)
        
        food_items[food_id] = {
            "id": food_id,
            "x": x,
            "y": y,
            "color": '#' + ''.join([random.choice('0123456789ABCDEF') for _ in range(6)]),
            "active": True
        }
    return food_items

def generate_food_from_segment(segment, color):
    """Generate a food item from a snake segment"""
    global food_id_counter
    food_id = str(food_id_counter)
    food_id_counter += 1
    
    return {
        "id": food_id,
        "x": segment["x"],
        "y": segment["y"],
        "color": color,
        "active": True
    }

def generate_leaderboard():
    if not snake_positions:
        return []
    
    leaderboard = []
    for snake_id, snake_info in snake_positions.items():
        # Only include alive snakes in the leaderboard
        if snake_info.get("alive", True):
            leaderboard.append({
                "id": snake_id,
                "name": snake_info.get("username", "Anonymous"),
                "score": snake_info.get("score", 0)
            })
    
    leaderboard.sort(key=lambda x: x["score"], reverse=True)
    
    return leaderboard[:10]

def update_and_broadcast_leaderboard():
    leaderboard = generate_leaderboard()
    if not leaderboard:
        return
    
    broadcast_to_all({
        "messageType": "leaderboard_update",
        "leaderboard": leaderboard
    })

def spawn_new_foods():
    global food_state
    
    try:
        active_food_count = sum(1 for food in food_state.values() if food["active"])
        
        if active_food_count < MAX_FOODS * 0.8:
            new_foods_count = min(30, MAX_FOODS - active_food_count)
            new_foods = generate_foods(new_foods_count)
            
            food_state.update(new_foods)
            
            new_foods_list = list(new_foods.values())
            if new_foods_list:
                broadcast_to_all({
                    "messageType": "new_foods",
                    "foods": new_foods_list
                })
    except Exception as e:
        print(f"Error spawning new foods: {e}")
    
    global food_spawn_thread
    food_spawn_thread = threading.Timer(5.0, spawn_new_foods)
    food_spawn_thread.daemon = True
    food_spawn_thread.start()

def start_food_spawn_thread():
    global food_spawn_thread
    if food_spawn_thread is None:
        food_spawn_thread = threading.Timer(10.0, spawn_new_foods)
        food_spawn_thread.daemon = True
        food_spawn_thread.start()

def broadcast_to_all(message, exclude_id=None):
    for client_id, client_ws in active_connections.items():
        if exclude_id is None or client_id != exclude_id:
            try:
                client_ws.send(json.dumps(message))
            except Exception as e:
                print(f"Error broadcasting to {client_id}: {e}")

def broadcast_food_update(food_id, is_active):
    broadcast_to_all({
        "messageType": "food_update",
        "food_id": food_id,
        "active": is_active
    })

def handle_player_death(snake_id, segments, color):
    """Handle a player's death, turn segments into food"""
    if snake_id not in snake_positions:
        return
    
    # Mark snake as dead in snake_positions
    snake_positions[snake_id]["alive"] = False
    
    # Convert some segments to food particles
    food_particles = []
    if segments and len(segments) > 0:
        # Convert every third segment to a food particle
        for i in range(0, len(segments), 3):
            new_food = generate_food_from_segment(segments[i], color)
            food_state[new_food["id"]] = new_food
            food_particles.append(new_food)
    
    # Notify all clients about the death
    broadcast_to_all({
        "messageType": "player_died",
        "snake_id": snake_id,
        "food_particles": food_particles
    })
    
    # Update leaderboard since this player is now "dead"
    update_and_broadcast_leaderboard()

def send_full_state(ws):
    snakes_data = []
    for snake_id, snake_info in snake_positions.items():
        snakes_data.append(snake_info)
    
    foods_data = []
    for food_id, food_info in food_state.items():
        if food_info["active"]:
            foods_data.append(food_info)
    
    ws.send(json.dumps({
        "messageType": "init_location",
        "snakes": snakes_data,
        "foods": foods_data
    }))
    
    leaderboard = generate_leaderboard()
    ws.send(json.dumps({
        "messageType": "leaderboard_update",
        "leaderboard": leaderboard
    }))

food_state = generate_foods(MAX_FOODS)

def handle_game_websocket(ws):
    start_food_spawn_thread()
    
    if "auth_token" not in request.cookies:
        ws.close(1008, "Not authenticated")
        return
    
    auth_token = request.cookies["auth_token"]
    hashed_auth = hashlib.sha256(auth_token.encode("utf-8")).hexdigest().encode("utf-8")
    user = db.user_collection.find_one({"token": hashed_auth})
    
    if not user:
        ws.close(1008, "User not found")
        return
    
    conn_id = auth_token
    active_connections[conn_id] = ws
    
    global food_state, last_food_sync
    if not food_state or (time.time() - last_food_sync > 3600):
        food_state = generate_foods(MAX_FOODS)
        last_food_sync = time.time()
    
    try:
        send_full_state(ws)
        
        while True:
            message = ws.receive()
            if message is None:
                break
                
            data = json.loads(message)
            message_type = data.get("messageType")
            
            if message_type == "join":
                snake_color = data.get("snake_color")
                username = data.get("username", user.get("username", "Anonymous"))
                snake_x = data.get("snake_x", 0)
                snake_y = data.get("snake_y", 0)
                alive = data.get("alive", True)
                
                snake_positions[conn_id] = {
                    "id": conn_id,
                    "x": snake_x,
                    "y": snake_y,
                    "color": snake_color,
                    "username": username,
                    "length": 1,
                    "segments": [],
                    "score": 0,
                    "alive": alive
                }
                
                broadcast_to_all({
                    "messageType": "snake_joined",
                    "snake": snake_positions[conn_id]
                }, conn_id)
                
                update_and_broadcast_leaderboard()
                
                leaderboard = generate_leaderboard()
                ws.send(json.dumps({
                    "messageType": "leaderboard_update",
                    "leaderboard": leaderboard
                }))
            
            elif message_type == "move":
                snake_color = data.get("snake_color")
                username = data.get("username", user.get("username", "Anonymous"))
                snake_x = data.get("snake_x", 0)
                snake_y = data.get("snake_y", 0)
                segments = data.get("segments", [])
                score = data.get("score", 0)
                length = data.get("length", 1)
                alive = data.get("alive", True)
                
                # Check if score changed
                score_changed = False
                if conn_id in snake_positions:
                    old_score = snake_positions[conn_id].get("score", 0)
                    score_changed = score > old_score
                
                snake_positions[conn_id] = {
                    "id": conn_id,
                    "x": snake_x,
                    "y": snake_y,
                    "color": snake_color,
                    "username": username,
                    "segments": segments,
                    "length": length,
                    "score": score,
                    "alive": alive
                }
                
                broadcast_to_all({
                    "messageType": "snake_update",
                    "snake": snake_positions[conn_id]
                }, conn_id)
                
                # Update leaderboard if score changed
                if score_changed:
                    update_and_broadcast_leaderboard()
            
            elif message_type == "player_died":
                snake_id = data.get("snake_id")
                segments = data.get("segments", [])
                color = data.get("color", "#FF0000")
                
                handle_player_death(snake_id, segments, color)
            
            elif message_type == "respawn":
                snake_color = data.get("snake_color")
                username = data.get("username", user.get("username", "Anonymous"))
                snake_x = data.get("snake_x", 0)
                snake_y = data.get("snake_y", 0)
                
                # Create or update snake after respawn
                snake_positions[conn_id] = {
                    "id": conn_id,
                    "x": snake_x,
                    "y": snake_y,
                    "color": snake_color,
                    "username": username,
                    "segments": [],
                    "length": 1,
                    "score": 0,
                    "alive": True
                }
                
                broadcast_to_all({
                    "messageType": "snake_joined",
                    "snake": snake_positions[conn_id]
                }, conn_id)
                
                update_and_broadcast_leaderboard()
            
            elif message_type == "eat_food":
                food_id = data.get("food_id")
                if food_id in food_state and food_state[food_id]["active"]:
                    food_state[food_id]["active"] = False
                    broadcast_food_update(food_id, False)
                    
                    def respawn_food():
                        if food_id in food_state:
                            # Randomly select a region to respawn food, increasing the probability in nearby regions
                            possible_regions = []
                            
                            # Add all regions, but give higher weight to border regions
                            for area_x in range(4):
                                for area_y in range(4):
                                    weight = 1
                                    if area_x == 0 or area_x == 3 or area_y == 0 or area_y == 3:
                                        weight = 3  # Higher weight for border regions
                                    
                                    for _ in range(weight):
                                        possible_regions.append((area_x, area_y))
                            
                            # Randomly select a region
                            region = random.choice(possible_regions)
                            region_x, region_y = region
                            
                            # Calculate the boundaries of the selected region
                            region_width = WORLD_WIDTH / 4
                            region_height = WORLD_HEIGHT / 4
                            
                            min_x = BORDER_THICKNESS + 20 + region_x * region_width
                            max_x = min_x + region_width - 40
                            min_y = BORDER_THICKNESS + 20 + region_y * region_height
                            max_y = min_y + region_height - 40
                            
                            # Place food randomly within the selected region
                            food_state[food_id]["x"] = random.uniform(min_x, max_x)
                            food_state[food_id]["y"] = random.uniform(min_y, max_y)
                            food_state[food_id]["active"] = True
                            
                            broadcast_food_update(food_id, True)
                    
                    respawn_thread = threading.Timer(1.0, respawn_food)  # Reduced to 1 second
                    respawn_thread.daemon = True
                    respawn_thread.start()
    
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if conn_id in active_connections:
            del active_connections[conn_id]
        if conn_id in snake_positions:
            broadcast_to_all({
                "messageType": "snake_left",
                "snake_id": conn_id
            })
            del snake_positions[conn_id]

def init_game_system():
    # Set up periodic leaderboard updates
    def schedule_leaderboard_updates():
        update_and_broadcast_leaderboard()
        threading.Timer(5.0, schedule_leaderboard_updates).start()
    
    threading.Timer(5.0, schedule_leaderboard_updates).start()
    threading.Timer(5.0, spawn_new_foods).start() 