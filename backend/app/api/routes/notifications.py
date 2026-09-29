import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import (
    NotificationActionResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.services.notifications import process_pending_notifications

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
def get_notifications(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    is_read: Optional[bool] = Query(None, description="Filter by read status. If omitted, returns unread notifications"),
    response: Response = None,
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns notifications for the current user.
    If is_read is not specified, defaults to unread notifications as per spec:
    'Returns unread notifications for the current user'
    """
    if background_tasks:
        background_tasks.add_task(process_pending_notifications)

    query = db.query(Notification).filter(Notification.recipient_user_id == current_user.id)
    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)
    else:
        # Default to unread notifications
        query = query.filter(Notification.is_read == False)

    total_count = query.count()
    items = (
        query.order_by(Notification.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    if response is not None:
        response.headers["X-Total-Count"] = str(total_count)
        response.headers["X-Page"] = str(page)
        response.headers["X-Limit"] = str(limit)

    return items


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_notification_count(
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns unread notification count for the current user.
    Used by the notification bell badge in navbar.
    Frontend polls this every 60 seconds.
    """
    if background_tasks:
        background_tasks.add_task(process_pending_notifications)

    count = (
        db.query(Notification)
        .filter(
            Notification.recipient_user_id == current_user.id,
            Notification.is_read == False,
        )
        .count()
    )
    return {"count": count}


@router.patch("/{notification_id}/read", response_model=NotificationActionResponse)
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marks a single notification as read for current user."""
    try:
        notif_uuid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid notification ID format",
        )

    notif = (
        db.query(Notification)
        .filter(Notification.id == notif_uuid)
        .first()
    )
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    if notif.recipient_user_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this notification",
        )

    notif.is_read = True
    db.commit()
    return NotificationActionResponse(
        success=True,
        message="Notification marked as read",
        id=notif.id,
        updated_count=1,
    )


@router.patch("/read-all", response_model=NotificationActionResponse)
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marks all unread notifications as read for current user."""
    updated = (
        db.query(Notification)
        .filter(
            Notification.recipient_user_id == current_user.id,
            Notification.is_read == False,
        )
        .update({"is_read": True}, synchronize_session="fetch")
    )
    db.commit()
    return NotificationActionResponse(
        success=True,
        message="All notifications marked as read",
        updated_count=updated,
    )


@router.post("/process-pending")
def trigger_process_pending_notifications(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Explicit trigger to check and deliver pending email/SMS notifications.
    Can be run synchronously or added to BackgroundTasks.
    """
    background_tasks.add_task(process_pending_notifications)
    return {"message": "Pending notification delivery task scheduled"}
