import backend.paths.auth_paths as auth
from flask import *

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/register")
def register():
    if("auth_token" in request.cookies):
        abort(400, "You are already logged-in. One must be logged-out before registering.")
    return render_template("register.html")

@app.route("/login", methods=["POST"])
def login():
    if ("auth_token" in request.cookies):
        abort(400, "You are already logged-in. One must be logged-out before logging-in.")
    return render_template("login.html")

@app.route("/logout")
def logout():
    if(not("auth_token" in request.cookies)):
        abort(400, "You are not logged-in. One must be logged-in before logging-out.")
    res: Response = Response()
    res.status_code = 302
    res.headers["Location"] = "/auth/logout"
    res.data = ""
    return res

@app.route("/auth/register", methods=["POST"])
def auth_register():
    return auth.receive_registration_credentials(request)

@app.route("/auth/login", methods=["POST"])
def auth_login():
    return auth.receive_login_credentials(request)

@app.route("/auth/logout", methods=["GET"])
def auth_logout():
    return auth.receive_logout_request(request)


if __name__ == '__main__':
    app.run()

