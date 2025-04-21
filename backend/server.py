from flask import Flask, send_from_directory
import os

app = Flask(__name__, static_folder='../wiggle-wars/dist', static_url_path='')

@app.route('/')
@app.route('/<path:path>')
def serve(path='index.html'):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# You can still define API routes as usual
@app.route('/api/hello')
def hello():
    return {'message': 'Hi from Flask!'}

if __name__ == '__main__':
    app.run(host="0.0.0.0", port="8080", debug=True)
