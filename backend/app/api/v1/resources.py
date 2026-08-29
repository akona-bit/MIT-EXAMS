from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import RequireRole, get_current_active_user
from app.core.analytics import capture
from app.db.database import get_db
from app.models.question import Resource, ResourceType
from app.models.user import User
from app.schemas.question import ResourceResponse

router = APIRouter()
RESOURCE_DIR = Path(__file__).resolve().parents[3] / "uploads" / "resources"
MAX_FILE_SIZE = 20 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    ".jpg": ResourceType.IMAGE,
    ".jpeg": ResourceType.IMAGE,
    ".png": ResourceType.IMAGE,
    ".webp": ResourceType.IMAGE,
    ".pdf": ResourceType.PDF,
    ".txt": ResourceType.TEXT,
    ".md": ResourceType.TEXT,
}


def _resource_response(resource: Resource) -> ResourceResponse:
    return ResourceResponse.model_validate(resource)


@router.get("/", response_model=list[ResourceResponse])
async def list_resources(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(Resource).order_by(Resource.created_at.desc()))
    return [_resource_response(resource) for resource in result.scalars().all()]


@router.post(
    "/upload",
    response_model=ResourceResponse,
    dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))],
)
async def upload_resource(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    original_name = Path(file.filename or "resource").name
    extension = Path(original_name).suffix.lower()
    resource_type = ALLOWED_EXTENSIONS.get(extension)
    if resource_type is None:
        raise HTTPException(status_code=400, detail="Định dạng file chưa được hỗ trợ")

    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File vượt quá giới hạn 20 MB")
    if not content:
        raise HTTPException(status_code=400, detail="Không thể lưu file rỗng")

    RESOURCE_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4().hex}{extension}"
    stored_path = RESOURCE_DIR / stored_name
    try:
        stored_path.write_bytes(content)
    except OSError as error:
        raise HTTPException(status_code=500, detail="Không thể ghi file vào kho ngữ liệu") from error

    resource = Resource(
        type=resource_type,
        content_url=f"/uploads/resources/{stored_name}",
        uploader_id=current_user.id,
        original_name=original_name,
        mime_type=file.content_type,
        size_bytes=len(content),
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    capture(
        request,
        "resource_uploaded",
        {"resource_id": resource.id, "resource_type": resource.type.value, "size_bytes": resource.size_bytes},
    )
    return resource


@router.delete(
    "/{resource_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))],
)
async def delete_resource(
    request: Request,
    resource_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Resource).where(Resource.id == resource_id))
    resource = result.scalars().first()
    if not resource:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngữ liệu")

    stored_path = RESOURCE_DIR / Path(resource.content_url).name
    if stored_path.exists():
        stored_path.unlink()
    resource_type = resource.type.value
    await db.delete(resource)
    await db.commit()
    capture(request, "resource_deleted", {"resource_id": resource_id, "resource_type": resource_type})
