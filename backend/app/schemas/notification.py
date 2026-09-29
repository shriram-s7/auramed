import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: uuid.UUID
    recipient_user_id: uuid.UUID
    recipient_type: str
    notification_type: str
    title: str
    message: str
    is_read: bool
    related_resource_type: Optional[str] = None
    related_resource_id: Optional[str] = None
    delivery_method: str
    delivery_status: str
    created_at: datetime
    sent_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    count: int


class NotificationActionResponse(BaseModel):
    success: bool = True
    message: str
    id: Optional[uuid.UUID] = None
    updated_count: Optional[int] = None
