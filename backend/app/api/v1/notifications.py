from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload
from typing import Optional
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.api.dependencies import RequireRole, get_current_user
from app.models.user import User
from app.models.notification import Notification, NotificationType

router = APIRouter()


class NotificationResponse(BaseModel):
    id: int
    type: NotificationType
    title: str
    message: str
    detail: Optional[str] = None
    link: Optional[str] = None
    is_read: bool
    created_at: Optional[str] = None
    sender_name: Optional[str] = None

    class Config:
        from_attributes = True


class SendNotificationRequest(BaseModel):
    recipient_id: Optional[int] = None
    role_name: Optional[str] = None
    send_to_all: bool = False
    type: NotificationType = NotificationType.SYSTEM
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    detail: Optional[str] = None
    link: Optional[str] = None


@router.get("/", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER", "STUDENT"]))])
async def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Notification).where(Notification.recipient_id == current_user.id)
    if unread_only:
        query = query.where(Notification.is_read == False)
    query = query.order_by(Notification.created_at.desc())

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()

    items = []
    for n in notifications:
        sender_name = None
        if n.sender_id:
            sender = await db.get(User, n.sender_id)
            sender_name = sender.full_name or sender.username if sender else None
        items.append({
            "id": n.id,
            "type": n.type.value if hasattr(n.type, "value") else n.type,
            "title": n.title,
            "message": n.message,
            "detail": n.detail,
            "link": n.link,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "sender_name": sender_name,
        })

    return {"total": total, "items": items}


@router.get("/unread-count", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER", "STUDENT"]))])
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = await db.scalar(
        select(func.count()).select_from(Notification).where(
            Notification.recipient_id == current_user.id,
            Notification.is_read == False,
        )
    ) or 0
    return {"count": count}


@router.put("/{notification_id}/read", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER", "STUDENT"]))])
async def mark_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_id == current_user.id,
        )
    )
    notification = result.scalars().first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    await db.commit()
    return {"message": "Marked as read"}


@router.put("/read-all", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER", "STUDENT"]))])
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.recipient_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER", "STUDENT"]))])
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_id == current_user.id,
        )
    )
    notification = result.scalars().first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.delete(notification)
    await db.commit()
    return {"message": "Deleted"}


@router.post("/send", dependencies=[Depends(RequireRole(["ADMIN"]))])
async def send_notification(
    req: SendNotificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin sends notification to user(s)."""
    recipients = []

    if req.send_to_all:
        result = await db.execute(select(User.id))
        recipients = [row[0] for row in result.all()]
    elif req.role_name:
        from app.models.user import Role
        role_result = await db.execute(select(Role).where(Role.name == req.role_name))
        role = role_result.scalars().first()
        if not role:
            raise HTTPException(status_code=400, detail="Invalid role")
        result = await db.execute(
            select(User.id).join(Role).where(Role.id == role.id)
        )
        recipients = [row[0] for row in result.all()]
    elif req.recipient_id:
        recipients = [req.recipient_id]
    else:
        raise HTTPException(status_code=400, detail="Must specify recipient_id, role_name, or send_to_all")

    notifications = []
    for rid in recipients:
        n = Notification(
            recipient_id=rid,
            sender_id=current_user.id,
            type=req.type,
            title=req.title,
            message=req.message,
            detail=req.detail,
            link=req.link,
        )
        db.add(n)
        notifications.append(n)

    await db.commit()

    return {
        "message": f"Sent notification to {len(recipients)} recipient(s)",
        "count": len(recipients),
    }
