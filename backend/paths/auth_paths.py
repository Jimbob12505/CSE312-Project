import hashlib
import uuid
import bcrypt
import pymongo
import database as db
import backend.tools.auth_tools as tools
from flask import Request, Response, jsonify
from typing import *
from werkzeug.utils import secure_filename
import os
from flask import current_app

def receive_registration_credentials(req: Request) -> Response:
    res: Response = Response()

    username: str = req.form.get("username")
    password: str = req.form.get("password")

    user: (Mapping[str, Any] | None) = db.user_collection.find_one({"username": username})

    if(not(user is None)):
        res.status_code = 400
        res.data = "Username taken"
    elif(not(tools.validate_password(password))):
        res.status_code = 400
        res.data = "Password invalid"
    else:
        hashed: bytes = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        user_id: str = str(uuid.uuid4())
        auth_token: str = str(uuid.uuid4())
        hashed_auth: bytes = hashlib.sha256(auth_token.encode("utf-8")).hexdigest().encode("utf-8")
        res.set_cookie("auth_token", auth_token, max_age=20000000, secure=True, httponly=True)
        db.user_collection.insert_one({"id": user_id, "username": username, "password": hashed, "token": hashed_auth})
        res.status_code = 200
        res.data = "Registration successful"

    return res

def receive_login_credentials(req: Request) -> Response:
    res: Response = Response()

    username: str = req.form.get("username")
    password: str = req.form.get("password")

    user: (Mapping[str, (str | bytes)] | None) = db.user_collection.find_one({"username": username})

    if(user is None):
        res.status_code = 400
        res.data = "Username does not exist"
    elif(not(bcrypt.checkpw(password.encode("utf-8"), user["password"]))):
        res.status_code = 400
        res.data = "Password does not match"
    else:
        auth_token: str = str(uuid.uuid4())
        res.set_cookie("auth_token", auth_token, max_age=20000000, secure=True, httponly=True)
        hashed_auth: bytes = hashlib.sha256(auth_token.encode("utf-8")).hexdigest().encode("utf-8")
        update_operation: dict[str, dict[str, (str | bytes)]] = {"$set": {"token": hashed_auth}}
        db.user_collection.update_one(user, update_operation)
        res.status_code = 200
        res.data = "Login successful"

    return res

def receive_logout_request(req: Request) -> Response:
    res: Response = Response()

    if(not("auth_token") in req.cookies):
        res.status_code = 400
        res.data = "No authentication token"
    else:
        auth_token: str = req.cookies["auth_token"]
        hashed_auth: bytes = hashlib.sha256(auth_token.encode("utf-8")).hexdigest().encode("utf-8")
        user: dict[str, (str | bytes)] = db.user_collection.find_one({"token": hashed_auth})

        logout_token: str = str(uuid.uuid4())
        hashed_logout: bytes = hashlib.sha256(logout_token.encode("utf-8")).hexdigest().encode("utf-8")

        res.set_cookie("auth_token", auth_token, max_age=0, secure=True, httponly=True)

        update_operation: dict[str, dict[str, (str | bytes)]] = {"$set": {"token": hashed_logout}}
        db.user_collection.update_one(user, update_operation)

        res.status_code = 302
        res.headers["Location"] = "/"

    return res

def receive_avatar_request(req: Request):
    res: Response = Response()
    IMG_DIR = os.path.join(current_app.static_folder, 'imgs')
    os.makedirs(IMG_DIR, exist_ok=True)

    if "auth_token" not in req.cookies:
        res.status_code = 400
        res.data = "No authentication token"
        return res

    auth_token = req.cookies["auth_token"]
    hashed_auth = hashlib.sha256(auth_token.encode("utf-8")).hexdigest().encode("utf-8")
    user = db.user_collection.find_one({"token": hashed_auth})


    # Handle file upload
    if 'image' not in req.files:
        res.status_code = 400
        res.data = "No image file provided"
        return res

    file = req.files['image']
    if file.filename == '':
        res.status_code = 400
        res.data = "Empty filename"
        return res

    # Sanitize and construct filename using username
    username_safe = secure_filename(user["username"])
    file_ext = os.path.splitext(secure_filename(file.filename))[1]
    filename = f"{username_safe}_{uuid.uuid4().hex}{file_ext}"

    file_path = os.path.join(IMG_DIR, filename)
    file.save(file_path)
    # Update DB with relative image URL
    update_operation = {"$set": {"imageURL": f"/imgs/{filename}"}}
    db.user_collection.update_one({"_id": user["_id"]}, update_operation)
    image_url = f"/imgs/{filename}"
    return jsonify({"imageURL": image_url}), 200