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
MAX_FOODS = 200
CANVAS_WIDTH = 1200
CANVAS_HEIGHT = 800
food_id_counter = 0
food_spawn_thread = None

def generate_foods(count=100, min_x=20, max_x=CANVAS_WIDTH-20, min_y=20, max_y=CANVAS_HEIGHT-20):
    food_items = {}
    global food_id_counter
    
    for i in range(count):
        food_id = str(food_id_counter)
        food_id_counter += 1
        food_items[food_id] = {
            "id": food_id,
            "x": random.uniform(min_x, max_x),
            "y": random.uniform(min_y, max_y),
            "color": '#' + ''.join([random.choice('0123456789ABCDEF') for _ in range(6)]),
            "active": True
        }
    return food_items

def generate_leaderboard():
    if not snake_positions:
        return []
    
    leaderboard = []
    for snake_id, snake_info in snake_positions.items():
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
        
        if active_food_count < MAX_FOODS * 0.7:
            new_foods_count = min(20, MAX_FOODS - active_food_count)
            new_foods = generate_foods(new_foods_count)
            
            food_state.update(new_foods)
            
            new_foods_list = list(new_foods.values())
            if new_foods_list:
                print(f"Spawning {len(new_foods_list)} new foods")
                broadcast_to_all({
                    "messageType": "new_foods",
                    "foods": new_foods_list
                })
    except Exception as e:
        print(f"Error spawning new foods: {e}")
    
    global food_spawn_thread
    food_spawn_thread = threading.Timer(10.0, spawn_new_foods)
    food_spawn_thread.daemon = True
    food_spawn_thread.start()

def start_food_spawn_thread():
    global food_spawn_thread
    if food_spawn_thread is None:
        food_spawn_thread = threading.Timer(30.0, spawn_new_foods)
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
                
                snake_positions[conn_id] = {
                    "id": conn_id,
                    "x": snake_x,
                    "y": snake_y,
                    "color": snake_color,
                    "username": username,
                    "length": 1,
                    "segments": [],
                    "score": 0
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
                    "score": score
                }
                
                broadcast_to_all({
                    "messageType": "snake_update",
                    "snake": snake_positions[conn_id]
                }, conn_id)
                
                # Update leaderboard if score changed
                if score_changed:
                    update_and_broadcast_leaderboard()
            
            elif message_type == "eat_food":
                food_id = data.get("food_id")
                if food_id in food_state and food_state[food_id]["active"]:
                    food_state[food_id]["active"] = False
                    broadcast_food_update(food_id, False)
                    
                    def respawn_food():
                        if food_id in food_state:
                            food_state[food_id]["x"] = random.uniform(20, CANVAS_WIDTH - 20)
                            food_state[food_id]["y"] = random.uniform(20, CANVAS_HEIGHT - 20)
                            food_state[food_id]["active"] = True
                            
                            broadcast_food_update(food_id, True)
                    
                    respawn_thread = threading.Timer(2.0, respawn_food)
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