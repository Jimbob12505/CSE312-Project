from flask import Flask, send_from_directory, request, jsonify, make_response
import os
import backend.paths.auth_paths as auth

app = Flask(__name__, 
            static_folder='frontend/dist', 
            static_url_path='')

@app.route('/api/hello')
def hello():
    return jsonify({'message': 'Hi from Flask!'})

@app.route("/auth/register", methods=["POST"])
def auth_register():
    return auth.receive_registration_credentials(request)

@app.route("/auth/login", methods=["POST"])
def auth_login():
    return auth.receive_login_credentials(request)

@app.route("/auth/logout", methods=["GET"])
def auth_logout():
    return auth.receive_logout_request(request)

# check if working correctly
@app.route('/health')
def health():
    return jsonify({'status': 'ok'})

# 明确定义前端路由，确保返回index.html
@app.route('/')
@app.route('/login')
@app.route('/register')
@app.route('/game')
def serve_frontend_route():
    return send_from_directory(app.static_folder, 'index.html')

# 处理静态资源和其他路径
@app.route('/<path:path>')
def serve_static(path):
    # 如果是API路由，返回404 (会被前面的路由处理)
    if path.startswith('api/') or path.startswith('auth/'):
        return make_response(jsonify({"error": "Not found"}), 404)
    
    # 如果文件存在，直接提供文件
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    
    # 如果是未知路径，返回404
    return make_response(jsonify({"error": "Not found"}), 404)

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8080, debug=True) 