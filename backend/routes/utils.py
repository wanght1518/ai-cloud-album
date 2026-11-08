from flask import Blueprint, request, g
from utils.jwt_utils import login_required
from services.storage_service import generate_presigned
from services.db_service import list_images_by_user, list_jobs_by_user

utils_bp = Blueprint("utils", __name__)

@utils_bp.route("/presigned-url", methods=["POST"])
@login_required
def get_presigned_url():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return {"success": False, "message": "JSON object required"}, 400

    s3_key = data.get("s3_key")
    if not isinstance(s3_key, str) or not s3_key.strip():
        return {"success": False, "message": "s3_key required"}, 400

    allowed = any(
        item.get("s3_key") == s3_key
        and item.get("status") != "deleted"
        for item in list_images_by_user(g.user_id)
    )

    if not allowed:
        allowed = any(
            job.get("type") == "download"
            and job.get("status") == "complete"
            and job.get("result_s3_key") == s3_key
            for job in list_jobs_by_user(g.user_id)
        )

    if not allowed:
        return {
            "success": False,
            "message": "file not found or access denied"
        }, 403

    result = generate_presigned(s3_key)

    if not result["ok"]:
        return {"success": False, "message": result["message"]}, 400

    return {
        "success": True,
        "data": {
            "url": result["url"]
        }
    }, 200