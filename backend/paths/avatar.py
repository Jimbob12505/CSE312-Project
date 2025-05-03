import hashlib
import uuid
import database as db
from flask import Request, Response

import os
import hashlib
import uuid
from flask import request, make_response
from werkzeug.utils import secure_filename

# Path to store uploaded images (adjust if necessary)
IMG_DIR = os.path.join(os.getcwd(), 'frontend', 'public', 'imgs')
os.makedirs(IMG_DIR, exist_ok=True)


def receive_avatar_request(req: Request) -> Response:
    res: Response = Response()

    if "auth_token" not in request.cookies:
        res.status_code = 400
        res.data = "No authentication token"
        return res

    auth_token = request.cookies["auth_token"]
    hashed_auth = hashlib.sha256(auth_token.encode("utf-8")).hexdigest().encode("utf-8")
    user = db.user_collection.find_one({"token": hashed_auth})

    if not user or "username" not in user:
        res.status_code = 403
        res.data = "Invalid authentication token or missing username"
        return res

    # Handle file upload
    if 'image' not in request.files:
        res.status_code = 400
        res.data = "No image file provided"
        return res

    file = request.files['image']
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

    res.status_code = 200
    res.data = "Image uploaded and user updated"
    return res
