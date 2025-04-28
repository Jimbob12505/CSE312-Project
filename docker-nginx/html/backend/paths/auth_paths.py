import hashlib
import uuid
import bcrypt
import database as db
import backend.tools.auth_tools as tools
from flask import Request, Response
from typing import *

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
