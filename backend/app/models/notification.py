import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.mixins import UUIDPKMixin


class Notification(Base, UUIDPKMixin):
    __tablename__ = "notifications"

    recipient_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    recipient_type = Column(String(50), nullable=False)  # doctor / patient / admin
    notification_type = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    related_resource_type = Column(String(100), nullable=True)
    related_resource_id = Column(String(255), nullable=True)
    delivery_method = Column(String(50), nullable=False, default="in_app")  # in_app / email / sms
    delivery_status = Column(String(50), nullable=False, default="sent")  # pending / sent / failed / permanently_failed
    retry_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    recipient = relationship("User", foreign_keys=[recipient_user_id])
