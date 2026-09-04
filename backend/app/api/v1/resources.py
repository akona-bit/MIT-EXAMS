from pathlib import Path
from uuid import uuid4
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import RequireRole, get_current_active_user
from app.core.analytics import capture
from app.core.supabase_client import supabase_client
from app.db.database import get_db
from app.models.question import ResourceType
from app.models.user import User
from app.schemas.question import ResourceResponse

router = APIRouter()
MAX_FILE_SIZE = 20 * 1024 * 1024

# Map extension → ResourceType
ALLOWED_EXTENSIONS = {
    ".jpg": ResourceType.IMAGE,
    ".jpeg": ResourceType.IMAGE,
    ".png": ResourceType.IMAGE,
    ".webp": ResourceType.IMAGE,
    ".gif": ResourceType.IMAGE,
    ".pdf": ResourceType.PDF,
    ".txt": ResourceType.TEXT,
    ".md": ResourceType.TEXT,
    ".doc": ResourceType.TEXT,
    ".docx": ResourceType.TEXT,
}

# Map ResourceType → Supabase bucket name
BUCKET_MAP = {
    ResourceType.TEXT: "van-ban",
    ResourceType.IMAGE: "hinh-anh",
    ResourceType.PDF: "pdf",
    ResourceType.HANDWRITING: "viet-tay",
    ResourceType.CHART: "bang-bieu",
}

# Map bucket name → ResourceType (dùng khi list từ 1 bucket)
BUCKET_TYPE_REVERSE = {v: k for k, v in BUCKET_MAP.items()}


def determine_type(mimetype: str, name: str) -> ResourceType:
    ext = Path(name).suffix.lower()
    if ext in ALLOWED_EXTENSIONS:
        return ALLOWED_EXTENSIONS[ext]
    if mimetype.startswith("image/"):
        return ResourceType.IMAGE
    if mimetype == "application/pdf":
        return ResourceType.PDF
    return ResourceType.TEXT


def get_bucket_for_type(resource_type: ResourceType) -> str:
    return BUCKET_MAP.get(resource_type, "van-ban")

@router.get("/", response_model=list[ResourceResponse])
async def list_resources(
    type: ResourceType | None = None,
    _current_user: User = Depends(get_current_active_user),
):
    """
    List resources từ Supabase storage.
    Nếu type=None → list từ tất cả buckets.
    Nếu type=? → list từ bucket tương ứng.
    """
    buckets_to_list = [BUCKET_MAP[type]] if type else list(BUCKET_MAP.values())
    
    response_list = []
    for bucket_name in buckets_to_list:
        try:
            files = supabase_client.storage.from_(bucket_name).list()
        except Exception as e:
            import logging
            logging.warning(f"Failed to list bucket {bucket_name}: {e}")
            continue
        
        resource_type = BUCKET_TYPE_REVERSE.get(bucket_name, ResourceType.TEXT)
        
        for f in files:
            if f.get("name") == ".emptyFolderPlaceholder":
                continue
                
            path = f.get("name")
            meta = f.get("metadata", {})
            
            try:
                signed_url_res = supabase_client.storage.from_(bucket_name).create_signed_url(path, 3600)
                signed_url = ""
                if isinstance(signed_url_res, dict) and "signedURL" in signed_url_res:
                    signed_url = signed_url_res["signedURL"]
                elif hasattr(signed_url_res, "get"):
                    signed_url = signed_url_res.get("signedURL")
            except Exception:
                signed_url = path
                
            created_str = f.get("created_at")
            try:
                created_dt = datetime.fromisoformat(created_str.replace("Z", "+00:00")) if created_str else datetime.utcnow()
            except Exception:
                created_dt = datetime.utcnow()

            response_list.append(ResourceResponse(
                id=f"{bucket_name}/{path}",
                type=resource_type,
                content_url=signed_url,
                original_name=path,
                mime_type=meta.get("mimetype"),
                size_bytes=meta.get("size", 0),
                created_at=created_dt,
                bucket=bucket_name,
            ))
    
    response_list.sort(key=lambda x: x.created_at, reverse=True)
    return response_list


@router.post(
    "/upload",
    response_model=ResourceResponse,
    dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))],
)
async def upload_resource(
    request: Request,
    file: UploadFile = File(...),
    type: ResourceType | None = None,
    current_user: User = Depends(get_current_active_user),
):
    """
    Upload file vào đúng bucket theo loại.
    Nếu type=None → tự detect từ extension.
    Nếu type=? → upload vào bucket tương ứng.
    """
    original_name = Path(file.filename or "resource").name
    extension = Path(original_name).suffix.lower()
    
    # Xác định loại file
    if type:
        resource_type = type
    else:
        resource_type = ALLOWED_EXTENSIONS.get(extension)
        if resource_type is None:
            if file.content_type and file.content_type.startswith("image/"):
                resource_type = ResourceType.IMAGE
            elif file.content_type == "application/pdf":
                resource_type = ResourceType.PDF
            else:
                resource_type = ResourceType.TEXT
    
    bucket_name = get_bucket_for_type(resource_type)
    
    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File vượt quá giới hạn 20 MB")
    if not content:
        raise HTTPException(status_code=400, detail="Không thể lưu file rỗng")

    stored_name = f"{uuid4().hex[:8]}_{original_name}"
    
    try:
        supabase_client.storage.from_(bucket_name).upload(
            file=content,
            path=stored_name,
            file_options={"content-type": file.content_type or "application/octet-stream"}
        )
    except Exception as error:
        import logging
        logging.error(f"Failed to upload to Supabase bucket {bucket_name}: {error}")
        raise HTTPException(status_code=500, detail=f"Không thể tải file lên: {error}") from error

    capture(
        request,
        "resource_uploaded",
        {"resource_id": stored_name, "resource_type": resource_type.value, "bucket": bucket_name, "size_bytes": len(content)},
    )
    
    try:
        signed_url_res = supabase_client.storage.from_(bucket_name).create_signed_url(stored_name, 3600)
        signed_url = ""
        if isinstance(signed_url_res, dict) and "signedURL" in signed_url_res:
            signed_url = signed_url_res["signedURL"]
        elif hasattr(signed_url_res, "get"):
            signed_url = signed_url_res.get("signedURL")
    except Exception:
        signed_url = stored_name

    return ResourceResponse(
        id=f"{bucket_name}/{stored_name}",
        type=resource_type,
        content_url=signed_url,
        original_name=stored_name,
        mime_type=file.content_type,
        size_bytes=len(content),
        created_at=datetime.utcnow(),
        bucket=bucket_name,
    )


@router.delete(
    "/{resource_id:path}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))],
)
async def delete_resource(
    request: Request,
    resource_id: str,
):
    """
    Xóa file từ Supabase storage.
    resource_id format: "bucket_name/file_name"
    """
    parts = resource_id.split("/", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="resource_id phải có dạng 'bucket/file_name'")
    
    bucket_name, file_name = parts
    
    # Validate bucket
    if bucket_name not in BUCKET_MAP.values():
        raise HTTPException(status_code=400, detail=f"Bucket không hợp lệ: {bucket_name}")
    
    try:
        supabase_client.storage.from_(bucket_name).remove([file_name])
    except Exception as e:
        import logging
        logging.error(f"Failed to delete file from Supabase bucket {bucket_name}: {e}")
        raise HTTPException(status_code=500, detail="Lỗi khi xóa file trên storage")

    capture(request, "resource_deleted", {"resource_id": resource_id, "bucket": bucket_name})
