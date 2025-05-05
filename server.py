import backend.paths.auth_paths as auth
from flask import Flask, send_from_directory, request, jsonify, make_response, abort, Response
import os
import hashlib
import json
import logging
from flask_sock import Sock
import database as db

import threading
import game_websocket as websocket
from backend.paths.auth_paths import receive_avatar_request

dist_dir = os.path.join('frontend', 'dist')
dev_dir = os.path.join('frontend', 'app')

if os.path.exists(dist_dir):
    static_folder = dist_dir
else:
    static_folder = dev_dir

app = Flask(__name__,
            static_folder=static_folder,
            static_url_path='')
            
# websocket
sock = Sock(app)

handler = logging.FileHandler("/logs/requests.log")
handler.setFormatter(logging.Formatter("%(asctime)s - %(message)s"))
app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO)

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
@app.route("/avatar")
def avatar():
    if (not ("auth_token" in request.cookies)):
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

@app.route("/auth/avatar", methods=["PUT"])
def auth_avatar():
    return receive_avatar_request(request)
@app.route('/auth/avatar', methods=['GET'])
def get_avatar():
    # Ensure the user is authenticated
    if "auth_token" not in request.cookies:
        return Response("No authentication token", status=400)

    auth_token = request.cookies["auth_token"]
    hashed_auth = hashlib.sha256(auth_token.encode("utf-8")).hexdigest().encode("utf-8")

    user = db.user_collection.find_one({"token": hashed_auth})
    if not user:
        return Response("User not found", status=404)

    # Fetch the current avatar URL from the user's data
    avatar_url = user.get("imageURL")
    if avatar_url:
        return jsonify({"imageURL": avatar_url})
    else:
        return Response("No avatar found", status=404)

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