import backend.paths.auth_paths as auth
from flask import Flask, g, send_from_directory, request, jsonify, make_response, abort, Response
import os
import hashlib
import json
import logging
from flask_sock import Sock
import database as db
import threading
import game_websocket as websocket
from logging.handlers import RotatingFileHandler
from werkzeug.middleware.proxy_fix import ProxyFix

dist_dir = os.path.join('frontend', 'dist')
dev_dir = os.path.join('frontend', 'app')

if os.path.exists(dist_dir):
    static_folder = dist_dir
else:
    static_folder = dev_dir

class ExceptionLoggingFlask(Flask):
    def wsgi_app(self, environ, start_response):
        try:
            return super(ExceptionLoggingFlask, self).wsgi_app(environ, start_response)
        except Exception:
            # logs full stack trace to app.logger
            self.logger.error("Unhandled Exception:\n%s", traceback.format_exc())
            raise

app = Flask(__name__, 
            static_folder=static_folder)

app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
# websocket
sock = Sock(app)

# set up a rotating file handler on app.logger
handler = RotatingFileHandler('requests.log', maxBytes=10_000_000, backupCount=5)
handler.setFormatter(
    logging.Formatter('%(asctime)s  %(levelname)s  %(message)s')
)
handler.setLevel(logging.INFO)
app.logger.setLevel(logging.INFO)
app.logger.addHandler(handler)

raw_handler = RotatingFileHandler(
    "requests_raw.log", maxBytes=10_000_000, backupCount=5
)
raw_handler.setLevel(logging.INFO)
raw_handler.setFormatter(logging.Formatter("%(asctime)s  %(message)s"))

raw_logger = logging.getLogger("raw_logger")
raw_logger.setLevel(logging.INFO)
raw_logger.addHandler(raw_handler)

def sanitize_headers(headers):
    cleaned = {}
    for name, value in headers.items():
        n = name.lower()
        if n == "authorization":
            cleaned[name] = "[REDACTED]"
        elif n == "cookie":
            # drop only auth_token from the cookie string
            parts = []
            for c in value.split("; "):
                if c.startswith("auth_token="):
                    continue
                parts.append(c)
            cleaned[name] = "; ".join(parts)
        else:
            cleaned[name] = value
    return cleaned

@app.after_request
def nosniff(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response

@app.before_request
def log_raw_request():
    headers = sanitize_headers(request.headers)
    path = request.path
    method = request.method

    # For login/register, only log headers (no body)
    if path in ("/auth/login", "/auth/register"):
        raw_logger.info("REQUEST  %s %s\nHeaders: %s",
                        method, path, headers)
        return

    ctype = request.content_type or ""
    # Only log body if it’s text or JSON or form-urlencoded
    if any(ctype.startswith(t) for t in ("text/",)) \
       or "application/json" in ctype \
       or "application/x-www-form-urlencoded" in ctype:
        data = request.get_data()[:2048]  # truncate at 2 KiB
        raw_logger.info(
            "REQUEST  %s %s\nHeaders: %s\nBody: %r",
            method, path, headers, data
        )
    else:
        raw_logger.info("REQUEST  %s %s\nHeaders: %s",
                        method, path, headers)

@app.after_request
def log_raw_response(response):
    headers = sanitize_headers(response.headers)
    method = request.method
    path = request.path
    status = response.status_code

    # 1) If it’s a streamed/direct_passthrough response, only log headers
    if getattr(response, "direct_passthrough", False):
        raw_logger.info(
            "RESPONSE %s %s → %s\nHeaders: %s\n[streamed body omitted]",
            method, path, status, headers
        )
        return response

    # 2) Special-case auth endpoints (no bodies)
    if path in ("/auth/login", "/auth/register"):
        raw_logger.info(
            "RESPONSE %s %s → %s\nHeaders: %s",
            method, path, status, headers
        )
        return response

    # 3) Otherwise, for JSON/text responses, truncate at 2 KiB
    ctype = response.content_type or ""
    if ("application/json" in ctype) or ctype.startswith("text/"):
        body = response.get_data()[:2048]
        raw_logger.info(
            "RESPONSE %s %s → %s\nHeaders: %s\nBody: %r",
            method, path, status, headers, body
        )
    else:
        # binary or other unlogged body types
        raw_logger.info(
            "RESPONSE %s %s → %s\nHeaders: %s\n[non-text body omitted]",
            method, path, status, headers
        )

    return response


def _get_current_username():
    token = request.cookies.get("auth_token")
    if not token:
        return None
    hashed = hashlib.sha256(token.encode()).digest()
    user = db.user_collection.find_one({"token": hashed})
    return user["username"] if user else None


@app.before_request
def attach_username_to_g():
    #g.username = _get_current_username()
    g.username = None
    token = request.cookies.get("auth_token")
    if token:
        # must match how you store it in Mongo:
        hashed = hashlib.sha256(token.encode("utf-8")).hexdigest().encode("utf-8")
        user = db.user_collection.find_one({"token": hashed})
        if user:
            g.username = user["username"]


@app.after_request
def log_request_and_response(response):
    username = g.get("username") or "anonymous"
    app.logger.info(
        "%s  %s  %s %s → %s",
        request.remote_addr,
        username,
        request.method,
        request.path,
        response.status_code
    )
    return response

@app.errorhandler(500)
def handle_server_error(e):
    app.logger.error(f"Server error: {str(e)}")
    return jsonify({"error": "Server "}), 500

@app.before_request
def log_request():
    app.logger.info(f"{request.remote_addr} {request.method} {request.path}")

@app.route("/")
def index():
    websocket.start_food_spawn_thread()
    log_request()
    return send_from_directory(app.static_folder, 'index.html')

@app.route("/register")
def register():
    if("auth_token" in request.cookies):
        abort(400, "You are already logged-in. One must be logged-out before registering.")
    return send_from_directory(app.static_folder, 'index.html')

@app.route("/login")
def login():
    if ("auth_token" in request.cookies):
        abort(400, "You are already logged-in. One must be logged-out before logging-in.")
    return send_from_directory(app.static_folder, 'index.html')

@app.route("/game")
def game():
    if(not("auth_token" in request.cookies)):
        # if not logged in, redirect to login page
        res = Response()
        res.status_code = 302
        res.headers["Location"] = "/login"
        return res
    return send_from_directory(app.static_folder, 'index.html')

@app.route("/profile")
def profile():
    if(not("auth_token" in request.cookies)):
        # if not logged in, redirect to login page
        res = Response()
        res.status_code = 302
        res.headers["Location"] = "/login"
        return res
    return send_from_directory(app.static_folder, 'index.html')

@app.route("/logout")
def logout():
    if(not("auth_token" in request.cookies)):
        abort(400, "You are not logged-in. One must be logged-in before logging-out.")
    res = Response()
    res.status_code = 302
    res.headers["Location"] = "/api/logout"
    return res

@sock.route("/ws/game")
def ws_game(ws):
    try:
        websocket.handle_game_websocket(ws)
    except Exception:
        try:
            ws.close(1011, "Internal server error")
        except:
            pass

@app.route("/auth/register", methods=["POST"])
def auth_register():
    return auth.receive_registration_credentials(request)

@app.route("/auth/login", methods=["POST"])
def auth_login():
    return auth.receive_login_credentials(request)

@app.route("/auth/logout", methods=["GET"])
def auth_logout():
    response = auth.receive_logout_request(request)
    if response.status_code == 302:
        response.headers["Location"] = "/login"
    return response

@app.route("/api/auth/status", methods=["GET"])
def auth_status():
    if "auth_token" in request.cookies:
        return jsonify({"isAuthenticated": True})
    return jsonify({"isAuthenticated": False})

@app.route("/user/current", methods=["GET"])
def user_current():
    if "auth_token" not in request.cookies:
        return make_response(jsonify({"error": "Not authenticated"}), 401)
    
    auth_token = request.cookies["auth_token"]
    hashed_auth = hashlib.sha256(auth_token.encode("utf-8")).hexdigest().encode("utf-8")
    
    user = db.user_collection.find_one({"token": hashed_auth})
    
    if not user:
        return make_response(jsonify({"error": "User not found"}), 404)
    
    return jsonify({
        "username": user["username"],
        "id": user["id"]
    })

@app.route("/user/stats", methods=["GET"])
def user_stats():
    if "auth_token" not in request.cookies:
        return make_response(jsonify({"error": "Not authenticated"}), 401)
    
    auth_token = request.cookies["auth_token"]
    hashed_auth = hashlib.sha256(auth_token.encode("utf-8")).hexdigest().encode("utf-8")
    
    user = db.user_collection.find_one({"token": hashed_auth})
    
    if not user:
        return make_response(jsonify({"error": "User not found"}), 404)
    
    # Get user stats from the database, default to 0 if not found
    stats = user.get("stats", {
        "highScore": 0,
        "avgSurvivalTime": 0,
        "longestSnake": 0,
        "totalFood": 0,
        "totalKills": 0
    })
    
    return jsonify(stats)

@app.route("/user/achievements", methods=["GET"])
def user_achievements():
    if "auth_token" not in request.cookies:
        return make_response(jsonify({"error": "Not authenticated"}), 401)
    
    auth_token = request.cookies["auth_token"]
    hashed_auth = hashlib.sha256(auth_token.encode("utf-8")).hexdigest().encode("utf-8")
    
    user = db.user_collection.find_one({"token": hashed_auth})
    
    if not user:
        return make_response(jsonify({"error": "User not found"}), 404)
    
    # Get user stats
    stats = user.get("stats", {
        "highScore": 0,
        "avgSurvivalTime": 0,
        "longestSnake": 0,
        "totalFood": 0, 
        "totalKills": 0,
        "gameCount": 0
    })
    
    # Define achievements with conditions
    achievements = [
        {
            "id": "snake_master",
            "name": "Snake Master",
            "description": "Grow your snake to at least 20 segments",
            "unlocked": stats.get("longestSnake", 0) >= 20,
            "progress": min(100, int(stats.get("longestSnake", 0) / 20 * 100)),
            "icon": "🐍"
        },
        {
            "id": "hungry_hunter",
            "name": "Hungry Hunter",
            "description": "Eat a total of 50 food items",
            "unlocked": stats.get("totalFood", 0) >= 50,
            "progress": min(100, int(stats.get("totalFood", 0) / 50 * 100)),
            "icon": "🍎"
        },
        {
            "id": "snake_slayer",
            "name": "Snake Slayer",
            "description": "Eliminate 10 other players",
            "unlocked": stats.get("totalKills", 0) >= 10,
            "progress": min(100, int(stats.get("totalKills", 0) / 10 * 100)),
            "icon": "⚔️"
        },
        {
            "id": "score_champion",
            "name": "Score Champion",
            "description": "Reach a high score of at least 30",
            "unlocked": stats.get("highScore", 0) >= 30,
            "progress": min(100, int(stats.get("highScore", 0) / 30 * 100)),
            "icon": "🏆"
        },
        {
            "id": "dedicated_player",
            "name": "Dedicated Player",
            "description": "Play at least 5 games",
            "unlocked": stats.get("gameCount", 0) >= 5,
            "progress": min(100, int(stats.get("gameCount", 0) / 5 * 100)),
            "icon": "🎮"
        }
    ]
    
    return jsonify(achievements)

@app.route("/user/save-stats", methods=["POST"])
def save_stats():
    if "auth_token" not in request.cookies:
        return make_response(jsonify({"error": "Not authenticated"}), 401)
    
    auth_token = request.cookies["auth_token"]
    hashed_auth = hashlib.sha256(auth_token.encode("utf-8")).hexdigest().encode("utf-8")
    
    user = db.user_collection.find_one({"token": hashed_auth})
    
    if not user:
        return make_response(jsonify({"error": "User not found"}), 404)
    
    data = request.json
    current_score = data.get("score", 0)
    current_length = data.get("length", 1)
    survival_time = data.get("survivalTime", 0)
    food_eaten = data.get("foodEaten", 0)
    kills = data.get("kills", 0)
    
    # Get existing stats
    existing_stats = user.get("stats", {
        "highScore": 0,
        "avgSurvivalTime": 0,
        "longestSnake": 0,
        "totalFood": 0,
        "totalKills": 0,
        "gameCount": 0
    })
    
    # Update stats
    game_count = existing_stats.get("gameCount", 0) + 1
    high_score = max(existing_stats.get("highScore", 0), current_score)
    longest_snake = max(existing_stats.get("longestSnake", 0), current_length)
    total_food = existing_stats.get("totalFood", 0) + food_eaten
    total_kills = existing_stats.get("totalKills", 0) + kills
    
    # Calculate new average survival time
    total_survival_time = existing_stats.get("avgSurvivalTime", 0) * (game_count - 1) + survival_time
    avg_survival_time = total_survival_time / game_count if game_count > 0 else 0
    
    # Update stats in the database
    updated_stats = {
        "highScore": high_score,
        "avgSurvivalTime": avg_survival_time,
        "longestSnake": longest_snake,
        "totalFood": total_food,
        "totalKills": total_kills,
        "gameCount": game_count
    }
    
    db.user_collection.update_one(
        {"token": hashed_auth},
        {"$set": {"stats": updated_stats}}
    )
    
    return jsonify({"success": True})

@app.route("/user/avatar", methods=["GET", "PUT"])
def user_avatar():
    if "auth_token" not in request.cookies:
        return make_response(jsonify({"error": "Not authenticated"}), 401)
    
    auth_token = request.cookies["auth_token"]
    hashed_auth = hashlib.sha256(auth_token.encode("utf-8")).hexdigest().encode("utf-8")
    
    user = db.user_collection.find_one({"token": hashed_auth})
    
    if not user:
        return make_response(jsonify({"error": "User not found"}), 404)
    
    if request.method == "GET":
        avatar_url = user.get("avatar_url", "")
        return jsonify({"url": avatar_url})
    
    elif request.method == "PUT":
        if 'image' not in request.files:
            return make_response(jsonify({"error": "No image file provided"}), 400)
        
        image_file = request.files['image']
        
        if image_file.filename == '':
            return make_response(jsonify({"error": "No image file selected"}), 400)
        
        # Setup avatars directory if it doesn't exist
        avatars_dir = os.path.join(app.static_folder, 'avatars')
        if not os.path.exists(avatars_dir):
            os.makedirs(avatars_dir)
            
        # Save the file with a unique name based on user ID
        filename = f"{user['id']}.jpg"
        filepath = os.path.join(avatars_dir, filename)
        
        # Save the image
        image_file.save(filepath)
        
        # Update the user's avatar URL in the database
        avatar_url = f"/avatars/{filename}"
        db.user_collection.update_one(
            {"token": hashed_auth},
            {"$set": {"avatar_url": avatar_url}}
        )
        
        return jsonify({"success": True, "url": avatar_url})

@app.route('/<path:path>')
def serve_static(path):
    if path.startswith('auth/'):
        return make_response(jsonify({"error": "Not found"}), 404)
        
    if os.path.exists(os.path.join(app.static_folder, path)):
        log_request()
        return send_from_directory(app.static_folder, path)
    
    log_request()
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    websocket.init_game_system()
    app.run(host="0.0.0.0", port=8080, debug=True, threaded=True)
