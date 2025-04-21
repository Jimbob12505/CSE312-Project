from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
import os
import logging


app = Flask(__name__, static_folder='../wiggle-wars/dist', static_url_path='')
CORS(app)

handler = logging.FileHandler("../backend/logs/requests.log")
handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO)

def log_request():
    app.logger.info(f"{request.remote_addr} {request.method} {request.path}")

@app.route('/')
@app.route('/<path:path>')
def serve(path='index.html'):
    if os.path.exists(os.path.join(app.static_folder, path)):
        log_request()
        return send_from_directory(app.static_folder, path)
    else:
        log_request()
        return send_from_directory(app.static_folder, 'index.html')

# You can still define API routes as usual
@app.route('/api/hello')
def hello():
    log_request()
    return {'message': 'Hi from Flask!'}

if __name__ == '__main__':
    app.run(host="0.0.0.0", port="8080", debug=True)
