import json
import threading
import time
import random
import hashlib
import database as db
from flask import request

connections_lock = threading.RLock()
snake_lock = threading.RLock()
food_lock = threading.RLock()

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

last_heartbeat = {}
HEARTBEAT_INTERVAL = 10
HEARTBEAT_TIMEOUT = 30

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
    with snake_lock:
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
    try:
        new_foods_list = []
        with food_lock:
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
    with connections_lock:
        client_ids = list(active_connections.keys())
    
    for client_id in client_ids:
        if exclude_id is None or client_id != exclude_id:
            try:
                with connections_lock:
                    if client_id in active_connections:
                        client_ws = active_connections[client_id]
                        client_ws.send(json.dumps(message))
            except Exception as e:
                print(f"Error broadcasting to {client_id}: {e}")
                disconnect_client(client_id)

def broadcast_food_update(food_id, is_active):
    broadcast_to_all({
        "messageType": "food_update",
        "food_id": food_id,
        "active": is_active
    })

def handle_player_death(snake_id, segments, color):
    """Handle a player's death, turn segments into food"""
    with snake_lock:
        if snake_id not in snake_positions:
            return
            
        # Check if player is already marked as dead to avoid duplicate processing
        if not snake_positions[snake_id].get("alive", True):
            print(f"Player {snake_id} already marked as dead, skipping death handling")
            return
        
        # Mark snake as dead in snake_positions
        snake_positions[snake_id]["alive"] = False
    
    # Convert some segments to food particles
    food_particles = []
    if segments and len(segments) > 0:
        # Convert every third segment to a food particle
        for i in range(0, len(segments), 3):
            new_food = generate_food_from_segment(segments[i], color)
            with food_lock:
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
    with snake_lock:
        snakes_data = []
        for snake_id, snake_info in snake_positions.items():
            snakes_data.append(snake_info)
    
    with food_lock:
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

with food_lock:
    food_state = generate_foods(MAX_FOODS)

def check_heartbeats():
    current_time = time.time()
    disconnected_clients = []
    
    with connections_lock:
        for client_id, _ in active_connections.items():
            if client_id in last_heartbeat:
                if current_time - last_heartbeat[client_id] > HEARTBEAT_TIMEOUT:
                    disconnected_clients.append(client_id)
    
    for client_id in disconnected_clients:
        print(f"Client {client_id} timed out. Disconnecting.")
        disconnect_client(client_id)
    
    heartbeat_thread = threading.Timer(HEARTBEAT_INTERVAL, check_heartbeats)
    heartbeat_thread.daemon = True
    heartbeat_thread.start()

def disconnect_client(client_id):
    """Clean up resources for a disconnected client"""
    with connections_lock:
        if client_id in active_connections:
            try:
                active_connections[client_id].close()
            except:
                pass
            del active_connections[client_id]
    
    # Only clean up snake if long disconnect
    # Check disconnect time
    current_time = time.time()
    is_long_disconnect = False
    
    if client_id in last_heartbeat:
        disconnect_duration = current_time - last_heartbeat[client_id]
        # If no heartbeat for over 30 seconds, consider it a long disconnect
        is_long_disconnect = disconnect_duration > 30
    else:
        # If no heartbeat record, also consider it a long disconnect
        is_long_disconnect = True
    
    # Only delete snake on long disconnect
    if is_long_disconnect:
        with snake_lock:
            if client_id in snake_positions:
                broadcast_to_all({
                    "messageType": "snake_left",
                    "snake_id": client_id
                })
                del snake_positions[client_id]
    
    # Remove from heartbeat records
    if client_id in last_heartbeat:
        del last_heartbeat[client_id]

def broadcast_to_nearby(message, sender_pos, radius=1200, exclude_id=None):
    with snake_lock:
        nearby_clients = []
        for client_id, snake in snake_positions.items():
            if client_id != exclude_id:
                dx = sender_pos["x"] - snake["x"]
                dy = sender_pos["y"] - snake["y"]
                dist = (dx**2 + dy**2)**0.5
                if dist <= radius:
                    nearby_clients.append(client_id)
    
    for client_id in nearby_clients:
        try:
            with connections_lock:
                if client_id in active_connections:
                    client_ws = active_connections[client_id]
                    client_ws.send(json.dumps(message))
        except Exception as e:
            print(f"Error broadcasting to nearby client {client_id}: {e}")
            disconnect_client(client_id)

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
    
    # Check if there's an existing connection for this user, clean it up first
    with connections_lock:
        if conn_id in active_connections:
            print(f"Found existing connection for {conn_id}, cleaning up first")
            old_ws = active_connections[conn_id]
            try:
                old_ws.close(1000, "Replaced by new connection")
            except:
                pass
            # Don't remove from active_connections yet, we'll replace it
    
    # Now safely set the new connection
    with connections_lock:
        active_connections[conn_id] = ws
    
    # Initialize heartbeat time
    last_heartbeat[conn_id] = time.time()
    
    global food_state, last_food_sync
    with food_lock:
        if not food_state or (time.time() - last_food_sync > 3600):
            food_state = generate_foods(MAX_FOODS)
            last_food_sync = time.time()
    
    try:
        send_full_state(ws)
        
        def send_heartbeat():
            try:
                if conn_id in active_connections:
                    ws.send(json.dumps({"messageType": "heartbeat"}))
                    threading.Timer(HEARTBEAT_INTERVAL, send_heartbeat).start()
            except:
                pass
        
        # 启动心跳发送
        send_heartbeat_thread = threading.Timer(HEARTBEAT_INTERVAL, send_heartbeat)
        send_heartbeat_thread.daemon = True
        send_heartbeat_thread.start()
        
        while True:
            message = ws.receive()
            if message is None:
                break
                
            last_heartbeat[conn_id] = time.time()
            
            data = json.loads(message)
            message_type = data.get("messageType")
            
            if message_type == "heartbeat_response":
                continue
            
            elif message_type == "join":
                snake_color = data.get("snake_color")
                username = data.get("username", user.get("username", "Anonymous"))
                snake_x = data.get("snake_x", 0)
                snake_y = data.get("snake_y", 0)
                alive = data.get("alive", True)
                
                with snake_lock:
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
                with snake_lock:
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
                    current_snake = snake_positions[conn_id].copy()
                
                broadcast_to_nearby({
                    "messageType": "snake_update",
                    "snake": current_snake
                }, {"x": snake_x, "y": snake_y}, radius=1200, exclude_id=conn_id)
                
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
                
                with snake_lock:
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
                    current_snake = snake_positions[conn_id].copy()
                
                broadcast_to_all({
                    "messageType": "snake_joined",
                    "snake": current_snake
                }, conn_id)
                
                update_and_broadcast_leaderboard()
            
            elif message_type == "eat_food":
                food_id = data.get("food_id")
                with food_lock:
                    if food_id in food_state and food_state[food_id]["active"]:
                        food_state[food_id]["active"] = False
                        broadcast_food_update(food_id, False)
                        
                        def respawn_food():
                            with food_lock:
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
        disconnect_client(conn_id)

def init_game_system():
    # Set up periodic leaderboard updates
    def schedule_leaderboard_updates():
        update_and_broadcast_leaderboard()
        threading.Timer(5.0, schedule_leaderboard_updates).start()
    
    threading.Timer(5.0, schedule_leaderboard_updates).start()
    threading.Timer(5.0, spawn_new_foods).start() 
    
    check_heartbeats() 